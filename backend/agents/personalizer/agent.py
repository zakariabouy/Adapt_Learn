"""
Agent 2 — Personalizer.

Consumes a LearnerModel (from Agent 1) + original teacher content and emits a
single bundle consumed by students AND parents:

    {
      "child_content":   simplified lesson text (Markdown, kid-friendly),
      "quiz":            [ {question, options, correct_index, explanation} ]  (3-5 items),
      "parent_summary":  parent-framed summary of what the child will learn
    }

One Gemini call, structured JSON output, deterministic heuristic fallback if
the LLM is unavailable so the three-agent pipeline always produces output.

Optional `recent_feedback` lets the agent cycle: when a child rates their last
delivery poorly, the Personalizer re-runs with the feedback as extra context.
"""

from __future__ import annotations

import os
import re
import json
import logging
from typing import Optional, List, Dict, Any
from uuid import UUID

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

from shared.database import get_pool
from shared.models import LearnerModel
from shared.guardrails import (
    run_input_guardrails,
    run_output_guardrails,
    validate_json_output,
)

logger = logging.getLogger(__name__)

_llm = None


def get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )
    return _llm


# ─────────────────────────────────────────────────────────────────────────────
# Helpers: recent child feedback for the cycle
# ─────────────────────────────────────────────────────────────────────────────

async def fetch_recent_feedback(
    student_id: UUID, content_id: UUID, limit: int = 3
) -> List[Dict[str, Any]]:
    """
    Returns the most recent child_feedback rows for this (student, content).
    Agent 2 uses these to bias the next personalization cycle.
    """
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT rating, tags, free_text, created_at
        FROM child_feedback
        WHERE student_id = $1 AND content_id = $2
        ORDER BY created_at DESC
        LIMIT $3
        """,
        student_id, content_id, limit,
    )
    return [
        {
            "rating": r["rating"],
            "tags": list(r["tags"] or []),
            "free_text": r["free_text"],
        }
        for r in rows
    ]


def _describe_profile(profile: LearnerModel) -> str:
    """Compact, LLM-friendly description of the learner."""
    tag_bits = []
    for tag in profile.learning_tags:
        s = profile.tag_strength.get(tag)
        tag_bits.append(f"{tag}({s:.1f})" if isinstance(s, (int, float)) else tag)
    tags_str = ", ".join(tag_bits) if tag_bits else "general learner"

    traits = ", ".join(profile.personality_traits) if profile.personality_traits else "—"
    hobbies = ", ".join(profile.hobbies) if profile.hobbies else "—"

    return (
        f"- learning_tags: {tags_str}\n"
        f"- preferred_modality: {profile.preferred_modality}\n"
        f"- reading_speed_wpm: {profile.reading_speed_wpm}\n"
        f"- chunk_size (chars): {profile.chunk_size}\n"
        f"- personality_traits: {traits}\n"
        f"- favorite_subject: {profile.favorite_subject or '—'}\n"
        f"- favorite_animal: {profile.favorite_animal or '—'}\n"
        f"- hobbies: {hobbies}"
    )


def _feedback_hint(feedback: List[Dict[str, Any]]) -> str:
    """Turn recent feedback into a short instruction for the LLM."""
    if not feedback:
        return ""
    tag_counter: Dict[str, int] = {}
    ratings = []
    for f in feedback:
        ratings.append(f["rating"])
        for t in f.get("tags") or []:
            tag_counter[t] = tag_counter.get(t, 0) + 1

    avg = sum(ratings) / len(ratings)
    top_tags = sorted(tag_counter.items(), key=lambda kv: -kv[1])[:3]
    tag_summary = ", ".join(f"{t} ×{c}" for t, c in top_tags) if top_tags else "none"

    guidance = []
    if "too_hard" in tag_counter:
        guidance.append("Make it EASIER: shorter sentences, simpler vocabulary, more examples.")
    if "too_easy" in tag_counter:
        guidance.append("Make it slightly more challenging: add one tougher quiz item.")
    if "confusing" in tag_counter:
        guidance.append("Rewrite unclear parts with concrete analogies.")
    if "boring" in tag_counter:
        guidance.append("Add a playful scenario tied to the child's interests.")
    guidance_str = " ".join(guidance) if guidance else "Keep tone encouraging."

    return (
        f"\n\nRECENT CHILD FEEDBACK (avg rating {avg:.1f}/5, flags: {tag_summary}):\n"
        f"{guidance_str}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Heuristic fallback — guarantees Agent 2 always produces something
# ─────────────────────────────────────────────────────────────────────────────

def _simple_sentences(text: str, max_chars: int) -> str:
    """Truncate by sentence boundary to roughly max_chars."""
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    out, length = [], 0
    for s in sentences:
        if length + len(s) > max_chars and out:
            break
        out.append(s)
        length += len(s)
    return " ".join(out)


def _heuristic_bundle(
    original_text: str, profile: LearnerModel, title: str
) -> Dict[str, Any]:
    """Deterministic bundle when Gemini is unavailable."""
    target_chars = max(400, int(profile.chunk_size or 200) * 4)
    child_content = _simple_sentences(original_text, target_chars)
    if not child_content:
        child_content = original_text[:target_chars]

    parent_summary = (
        f"Your child is studying: **{title}**. "
        f"The lesson has been trimmed to about {len(child_content)} characters "
        f"to match their reading profile. Encourage them to read it aloud and "
        f"share one thing they learned at dinner tonight."
    )

    return {
        "child_content": child_content,
        "quiz": [],
        "parent_summary": parent_summary,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main entry
# ─────────────────────────────────────────────────────────────────────────────

async def personalize_content(
    profile: LearnerModel,
    original_text: str,
    title: str = "Lesson",
    subject: str = "General",
    grade_level: int = 3,
    recent_feedback: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Agent 2 — single LLM call that produces child_content + quiz + parent_summary.
    Returns a dict with exactly those three keys. Heuristic fallback on failure.
    """
    # Input guardrails on the original content
    input_check = await run_input_guardrails(original_text, endpoint="personalizer/generate")
    safe_text = input_check["sanitized_text"]

    profile_desc = _describe_profile(profile)
    feedback_hint = _feedback_hint(recent_feedback or [])

    prompt = f"""You are a personalizer for a primary-school learning platform.
Your job: turn ONE lesson into a bundle tailored to ONE specific child, and
write a separate short summary for that child's parent.

## Learner profile
{profile_desc}

## Lesson metadata
- title: {title}
- subject: {subject}
- target grade: {grade_level} (ages {grade_level + 5}-{grade_level + 6})

## Original lesson (from the teacher)
{safe_text[:4000]}
{feedback_hint}

## Your task — produce a single JSON object (no markdown fences, no prose around it):

{{
  "child_content": "Markdown lesson rewritten for THIS child. Simpler vocabulary, \
sentence length tuned to their reading speed, references to their interests when natural. \
Keep all the teacher's pedagogical points. Target length ~{max(400, int(profile.chunk_size or 200) * 4)} characters.",
  "quiz": [
    {{
      "question": "Clear, kid-friendly question tied to the lesson",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "One-sentence gentle explanation (teach, don't just state)"
    }}
    // 3-5 items total. Mix of difficulties.
  ],
  "parent_summary": "2-3 sentences written TO the parent (not the child). \
Say what the child is learning, what they may struggle with, and ONE concrete \
thing the parent can do at home to reinforce it. No jargon."
}}

RULES:
- Content MUST be safe for ages {grade_level + 5}-{grade_level + 6}. No violence, no scary themes.
- Never invent facts outside the source lesson.
- `correct_index` is 0-based (0..3).
- Return ONLY the JSON object. No backticks, no commentary."""

    heuristic = _heuristic_bundle(safe_text, profile, title)

    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        raw = response.content.strip()

        # Strip accidental code fences
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1].lstrip("json\n").strip()
            if raw.endswith("```"):
                raw = raw.rsplit("```", 1)[0].strip()

        check = validate_json_output(
            raw, required_keys=["child_content", "quiz", "parent_summary"]
        )
        if not check["valid"]:
            logger.warning("Agent 2 JSON invalid (%s) — using heuristic", check["errors"])
            return heuristic

        bundle = check["parsed"]

        # Normalize quiz shape (defensive)
        quiz_items: List[Dict[str, Any]] = []
        for q in bundle.get("quiz") or []:
            opts = q.get("options") or []
            if not isinstance(opts, list) or len(opts) < 2:
                continue
            idx = q.get("correct_index", 0)
            if not isinstance(idx, int) or idx < 0 or idx >= len(opts):
                idx = 0
            quiz_items.append({
                "question": str(q.get("question", "")).strip(),
                "options": [str(o) for o in opts],
                "correct_index": idx,
                "explanation": str(q.get("explanation", "")).strip(),
            })

        child_content = str(bundle.get("child_content", "")).strip() or heuristic["child_content"]
        parent_summary = str(bundle.get("parent_summary", "")).strip() or heuristic["parent_summary"]

        # Output guardrails on both human-facing strings
        child_check = await run_output_guardrails(
            child_content, source_text=safe_text, endpoint="personalizer/child"
        )
        parent_check = await run_output_guardrails(
            parent_summary, endpoint="personalizer/parent"
        )

        return {
            "child_content": child_check["filtered_text"],
            "quiz": quiz_items,
            "parent_summary": parent_check["filtered_text"],
        }

    except Exception as e:
        logger.warning("Agent 2 Gemini call failed (%s) — using heuristic", e)
        return heuristic
