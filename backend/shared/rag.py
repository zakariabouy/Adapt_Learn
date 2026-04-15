"""
RAG (Retrieval-Augmented Generation) Module

Core knowledge retrieval layer for AdaptLearn. All agents use this module
to access pedagogical content dynamically via semantic search, rather than
receiving raw text blobs.

Pipeline:
  1. Content upload  -> chunk_text_for_rag() -> embed via Gemini -> store in content_chunks
  2. Agent needs ctx -> embed query           -> cosine search   -> return top-K chunks

Uses Google text-embedding-004 (768-d) and pgvector for storage + HNSW search.
"""

import os
import json
import logging
import re
from typing import List, Dict, Optional
from uuid import UUID

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from shared.database import get_pool

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Embedding model (singleton)
# ---------------------------------------------------------------------------

_embed_model = None


def get_embeddings_model() -> GoogleGenerativeAIEmbeddings:
    global _embed_model
    if _embed_model is None:
        _embed_model = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )
    return _embed_model


def _format_vector(embedding: list) -> str:
    """Format a Python float list as a pgvector-compatible literal '[0.1,0.2,...]'."""
    return "[" + ",".join(str(x) for x in embedding) + "]"


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------


def chunk_text_for_rag(
    text: str,
    chunk_size: int = 500,
    overlap: int = 100,
) -> List[str]:
    """
    Split *text* into overlapping chunks at sentence boundaries.

    Overlap ensures that concepts spanning two chunks are not lost.
    Sentence-boundary splitting avoids cutting mid-sentence.
    """
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    if not sentences:
        return [text.strip()] if text.strip() else []

    chunks: List[str] = []
    current = ""

    for sentence in sentences:
        # Would adding this sentence exceed the budget?
        if current and len(current) + len(sentence) + 1 > chunk_size:
            chunks.append(current.strip())
            # Build overlap seed from the tail of the current chunk
            words = current.split()
            overlap_text = ""
            for w in reversed(words):
                candidate = w + " " + overlap_text if overlap_text else w
                if len(candidate) > overlap:
                    break
                overlap_text = candidate
            current = (overlap_text.strip() + " " + sentence).strip()
        else:
            current += (" " if current else "") + sentence

    if current.strip():
        chunks.append(current.strip())

    return chunks if chunks else [text.strip()]


# ---------------------------------------------------------------------------
# Embed + Store
# ---------------------------------------------------------------------------


async def embed_and_store_content(
    content_id: UUID,
    text: str,
    metadata: Optional[dict] = None,
) -> int:
    """
    Chunk *text*, generate embeddings, store in ``content_chunks``.

    Idempotent: deletes existing chunks for *content_id* before inserting.
    Returns the number of chunks stored successfully.
    """
    pool = await get_pool()
    model = get_embeddings_model()

    # Remove previous chunks (re-embed safe)
    await pool.execute(
        "DELETE FROM content_chunks WHERE content_id = $1", content_id
    )

    chunks = chunk_text_for_rag(text)
    if not chunks:
        return 0

    # Batch embed
    try:
        embeddings = await model.aembed_documents(chunks)
    except Exception as e:
        logger.error("Embedding generation failed for content %s: %s", content_id, e)
        return 0

    # Insert each chunk
    count = 0
    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        try:
            chunk_meta = {
                **(metadata or {}),
                "chunk_index": i,
                "char_count": len(chunk),
            }
            await pool.execute(
                """
                INSERT INTO content_chunks
                    (content_id, chunk_index, chunk_text, embedding, metadata)
                VALUES ($1, $2, $3, $4::vector, $5)
                """,
                content_id,
                i,
                chunk,
                _format_vector(emb),
                json.dumps(chunk_meta),
            )
            count += 1
        except Exception as e:
            logger.error(
                "Failed to store chunk %d for content %s: %s", i, content_id, e
            )

    logger.info(
        "RAG: stored %d/%d chunks for content %s", count, len(chunks), content_id
    )
    return count


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------


async def retrieve_relevant_chunks(
    query: str,
    content_id: Optional[UUID] = None,
    top_k: int = 5,
    similarity_threshold: float = 0.25,
) -> List[Dict]:
    """
    Embed *query* and return the closest content chunks by cosine similarity.

    Args:
        query:                Natural-language search query.
        content_id:           Restrict search to a single content item (optional).
        top_k:                Maximum chunks to return.
        similarity_threshold: Minimum cosine similarity (0-1).

    Returns:
        List of dicts with keys: chunk_text, content_id, chunk_index,
        similarity, metadata.
    """
    pool = await get_pool()
    model = get_embeddings_model()

    try:
        query_emb = await model.aembed_query(query)
    except Exception as e:
        logger.error("Query embedding failed: %s", e)
        return []

    vec_literal = _format_vector(query_emb)

    if content_id:
        rows = await pool.fetch(
            """
            SELECT chunk_text, content_id, chunk_index, metadata,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM content_chunks
            WHERE content_id = $2
              AND 1 - (embedding <=> $1::vector) > $3
            ORDER BY embedding <=> $1::vector
            LIMIT $4
            """,
            vec_literal,
            content_id,
            similarity_threshold,
            top_k,
        )
    else:
        rows = await pool.fetch(
            """
            SELECT chunk_text, content_id, chunk_index, metadata,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM content_chunks
            WHERE 1 - (embedding <=> $1::vector) > $2
            ORDER BY embedding <=> $1::vector
            LIMIT $3
            """,
            vec_literal,
            similarity_threshold,
            top_k,
        )

    return [
        {
            "chunk_text": r["chunk_text"],
            "content_id": r["content_id"],
            "chunk_index": r["chunk_index"],
            "similarity": round(float(r["similarity"]), 4),
            "metadata": (
                json.loads(r["metadata"])
                if isinstance(r["metadata"], str)
                else r["metadata"]
            ),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# High-level helpers (used directly by agents)
# ---------------------------------------------------------------------------


async def build_rag_context(
    query: str,
    content_id: Optional[UUID] = None,
    top_k: int = 5,
    max_context_chars: int = 3000,
) -> str:
    """
    Retrieve relevant chunks and format them as a single context string
    ready to inject into an agent prompt.

    Returns an empty string if nothing relevant is found.
    """
    chunks = await retrieve_relevant_chunks(query, content_id, top_k)
    if not chunks:
        return ""

    parts: List[str] = []
    total = 0
    for c in chunks:
        text = c["chunk_text"]
        if total + len(text) > max_context_chars:
            break
        parts.append(f"[Relevance: {c['similarity']:.0%}]\n{text}")
        total += len(text)

    return "\n\n---\n\n".join(parts)


async def retrieve_for_student(
    student_id: UUID,
    query: str,
    content_id: Optional[UUID] = None,
    top_k: int = 5,
) -> List[Dict]:
    """
    Student-aware retrieval: fetches relevant chunks and boosts results
    that match the student's grade level.
    """
    pool = await get_pool()

    grade_row = await pool.fetchrow(
        "SELECT grade_level FROM users WHERE id = $1", student_id
    )
    student_grade = grade_row["grade_level"] if grade_row else None

    # Fetch more than needed so we can re-rank
    chunks = await retrieve_relevant_chunks(query, content_id, top_k=top_k * 2)

    if student_grade and not content_id:
        for chunk in chunks:
            cid = chunk["content_id"]
            grade = await pool.fetchval(
                "SELECT grade_level FROM content_items WHERE id = $1", cid
            )
            if grade and grade == student_grade:
                chunk["similarity"] += 0.1  # boost same-grade content

        chunks.sort(key=lambda x: x["similarity"], reverse=True)

    return chunks[:top_k]


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


async def reembed_all_content() -> Dict:
    """
    Re-embed every content item. Useful after migration or model upgrade.
    Returns {total, success, failed}.
    """
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, original_text, subject, grade_level FROM content_items"
    )

    total = len(rows)
    success = 0
    failed = 0

    for row in rows:
        meta = {"subject": row["subject"], "grade_level": row["grade_level"]}
        n = await embed_and_store_content(row["id"], row["original_text"], meta)
        if n > 0:
            success += 1
        else:
            failed += 1

    logger.info(
        "RAG reembed complete: %d total, %d success, %d failed",
        total, success, failed,
    )
    return {"total": total, "success": success, "failed": failed}
