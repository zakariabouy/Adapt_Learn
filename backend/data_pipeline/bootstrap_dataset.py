"""
AdaptLearn — Dataset Bootstrapper
===================================
Pulls every lesson from your PostgreSQL `content` table, runs each one
through your existing Gemini v3 personalizer with 6 learner-profile
archetypes, and saves (prompt, completion) pairs as JSONL.

At the end it pushes the dataset to your private HuggingFace Hub repo.

Usage (from the backend/ directory):
    python data_pipeline/bootstrap_dataset.py

Requirements in .env:
    DATABASE_URL   — your PostgreSQL connection string
    GOOGLE_API_KEY — for Gemini calls

HuggingFace auth (for the Hub push at the end):
    Run `hf auth login` once with a Write-scoped token. Credentials are
    cached globally at ~/.cache/huggingface/token — no token in .env needed.

Output:
    data_pipeline/output/raw_pairs.jsonl        — all generated pairs
    data_pipeline/output/filtered_pairs.jsonl   — quality-filtered pairs
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv

# ── Make sure backend/ is on sys.path so shared/* and agents/* resolve ──────
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(BACKEND_DIR / ".env")

from shared.database import get_pool
from shared.models import LearnerModel
from agents.personalizer.agent import personalize_content
from agents.personalizer.prompt_builder import build_v3_prompt

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bootstrapper")

# ── Config ───────────────────────────────────────────────────────────────────

HF_REPO_ID   = os.getenv("HF_DATASET_REPO", "AdaptLearn/men-sft-v1")
OUTPUT_DIR   = Path(__file__).parent / "output"
RAW_PATH     = OUTPUT_DIR / "raw_pairs.jsonl"
FILTERED_PATH = OUTPUT_DIR / "filtered_pairs.jsonl"

# Minimum quality threshold — pairs below this are excluded from training
MIN_QUALITY_SCORE = 3.5   # out of 5

# Delay between Gemini calls (seconds) — avoids rate-limit errors.
# Override via GEMINI_DELAY env (e.g. 5 for single-key free-tier RPM limits).
GEMINI_DELAY = float(os.getenv("GEMINI_DELAY", "1.2"))

# ── 6 Learner Profile Archetypes ─────────────────────────────────────────────
# Each archetype represents a realistic neurodivergent profile your
# platform serves. Running each lesson through all 6 gives you diverse
# training pairs from a single piece of content.

LEARNER_ARCHETYPES: List[Dict[str, Any]] = [
    {
        "name": "tdah_visual",
        "learning_tags": ["tdah", "visual_learner", "short_attention", "gamification"],
        "tag_strength": {"tdah": 0.9, "visual_learner": 0.8, "short_attention": 0.85},
        "preferred_modality": "visual",
        "chunk_size": 80,
        "reading_speed_wpm": 120,
        "favorite_subject": "maths",
        "favorite_animal": "lion",
        "hobbies": ["football", "dessin"],
    },
    {
        "name": "dyslexie_audio",
        "learning_tags": ["dyslexie", "audio_learner", "slow_reader", "needs_repetition"],
        "tag_strength": {"dyslexie": 0.8, "audio_learner": 0.9, "slow_reader": 0.75},
        "preferred_modality": "audio",
        "chunk_size": 60,
        "reading_speed_wpm": 80,
        "favorite_subject": "musique",
        "favorite_animal": "chat",
        "hobbies": ["chant", "jeux"],
    },
    {
        "name": "precoce_lecture",
        "learning_tags": ["fast_learner", "visual_learner", "curious"],
        "tag_strength": {"fast_learner": 0.9, "visual_learner": 0.7},
        "preferred_modality": "reading",
        "chunk_size": 200,
        "reading_speed_wpm": 280,
        "favorite_subject": "sciences",
        "favorite_animal": "aigle",
        "hobbies": ["lecture", "informatique"],
    },
    {
        "name": "kinesthesique_tdah",
        "learning_tags": ["kinesthesique", "tdah", "short_attention", "needs_repetition"],
        "tag_strength": {"kinesthesique": 0.85, "tdah": 0.7, "short_attention": 0.8},
        "preferred_modality": "kinesthetic",
        "chunk_size": 70,
        "reading_speed_wpm": 110,
        "favorite_subject": "sport",
        "favorite_animal": "cheval",
        "hobbies": ["sport", "bricolage"],
    },
    {
        "name": "general_standard",
        "learning_tags": ["visual_learner"],
        "tag_strength": {"visual_learner": 0.5},
        "preferred_modality": "text",
        "chunk_size": 150,
        "reading_speed_wpm": 200,
        "favorite_subject": "français",
        "favorite_animal": "chien",
        "hobbies": ["lecture", "jeux"],
    },
    {
        "name": "multilingue_amazigh",
        "learning_tags": ["audio_learner", "visual_learner"],
        "tag_strength": {"audio_learner": 0.7, "visual_learner": 0.6},
        "preferred_modality": "audio",
        "chunk_size": 100,
        "reading_speed_wpm": 140,
        "favorite_subject": "arabe",
        "favorite_animal": "mouton",
        "hobbies": ["musique", "cuisine"],
        "personality_traits": ["curieux", "sociable"],
    },
]


def _make_profile(archetype: Dict[str, Any], student_id: str = "bootstrap-001") -> LearnerModel:
    """Build a LearnerModel from an archetype dict."""
    return LearnerModel(
        student_id=student_id,
        learning_tags=archetype.get("learning_tags", []),
        tag_strength=archetype.get("tag_strength", {}),
        preferred_modality=archetype.get("preferred_modality", "text"),
        chunk_size=archetype.get("chunk_size", 150),
        reading_speed_wpm=archetype.get("reading_speed_wpm", 200),
        favorite_subject=archetype.get("favorite_subject"),
        favorite_animal=archetype.get("favorite_animal"),
        hobbies=archetype.get("hobbies", []),
        personality_traits=archetype.get("personality_traits", []),
    )


def _score_output(bundle: Dict[str, Any]) -> float:
    """
    Simple heuristic quality score (0-5).
    A full Critic-agent pass can replace this later.
    """
    score = 5.0

    child = bundle.get("child_content", "")
    quiz  = bundle.get("quiz", [])
    men_tags = bundle.get("men_tags", [])
    anchors  = bundle.get("cultural_anchors", [])

    # Penalise very short outputs
    if len(child) < 200:
        score -= 2.0
    elif len(child) < 400:
        score -= 0.5

    # Penalise missing quiz
    if not quiz:
        score -= 1.5
    elif len(quiz) < 3:
        score -= 0.5

    # Reward MEN tags and cultural anchors (v3 feature)
    if not men_tags:
        score -= 0.5
    if not anchors:
        score -= 0.5

    return max(0.0, score)


# Minimum usable lesson length (chars). Below this is treated as a test/junk
# upload (e.g. "test content for upload.") rather than a real lesson.
MIN_CONTENT_CHARS = 120


async def fetch_content_items(pool) -> List[Dict[str, Any]]:
    """
    Fetch real, de-duplicated lessons from the database.

    content_items can contain re-uploads of the same lesson and short test
    stubs. We drop anything below MIN_CONTENT_CHARS and collapse exact-duplicate
    bodies (keeping the first by created_at) so a single lesson isn't
    over-represented across the training set.
    """
    rows = await pool.fetch(
        """
        SELECT id, title, original_text, subject, grade_level
        FROM content_items
        ORDER BY created_at ASC
        """
    )
    items = []
    seen_bodies: set[str] = set()
    for r in rows:
        text = (r["original_text"] or "").strip()
        if len(text) < MIN_CONTENT_CHARS:
            continue
        # De-dup on normalised body so re-uploads of the same lesson collapse.
        fingerprint = " ".join(text.split()).lower()
        if fingerprint in seen_bodies:
            continue
        seen_bodies.add(fingerprint)
        items.append({
            "id":            str(r["id"]),
            "title":         r["title"] or "Leçon",
            "original_text": r["original_text"],
            "subject":       r["subject"] or "general",
            "grade_level":   r["grade_level"] or 3,
        })
    return items


async def generate_pair(
    content: Dict[str, Any],
    archetype: Dict[str, Any],
) -> Dict[str, Any] | None:
    """
    Run one (content × archetype) combination through the Gemini personalizer.
    Returns a training pair dict, or None if generation fails.
    """
    profile = _make_profile(archetype, student_id=f"bootstrap-{content['id'][:8]}")

    try:
        # Build the exact prompt that will be used during inference
        prompt_str = build_v3_prompt(
            profile_desc=_profile_to_desc(profile),
            title=content["title"],
            subject=content["subject"],
            grade_level=content["grade_level"],
            safe_text=content["original_text"],
            target_chars=max(400, profile.chunk_size * 4),
            feedback_hint="",
        )

        # Call your existing Gemini agent
        bundle = await personalize_content(
            profile=profile,
            original_text=content["original_text"],
            title=content["title"],
            subject=content["subject"],
            grade_level=content["grade_level"],
        )

        quality = _score_output(bundle)

        return {
            # ── Core training fields ─────────────────────
            "prompt":     prompt_str,
            "completion": json.dumps(bundle, ensure_ascii=False),
            # ── Metadata (not used for training, used for filtering/eval) ──
            "metadata": {
                "content_id":    content["id"],
                "title":         content["title"],
                "subject":       content["subject"],
                "grade_level":   content["grade_level"],
                "archetype":     archetype["name"],
                "men_tags":      bundle.get("men_tags", []),
                "cultural_anchors": bundle.get("cultural_anchors", []),
                "quality_score": round(quality, 2),
                "source":        f"{os.getenv('LLM_PROVIDER', 'gemini')}_icft_v3",
            },
        }

    except Exception as exc:
        log.warning(
            "Failed: content=%s archetype=%s — %s",
            content["id"][:8], archetype["name"], exc
        )
        return None


def _profile_to_desc(profile: LearnerModel) -> str:
    """Reproduce the profile description used in agent.py."""
    tag_bits = []
    for tag in profile.learning_tags:
        s = profile.tag_strength.get(tag)
        tag_bits.append(f"{tag}({s:.1f})" if isinstance(s, (int, float)) else tag)
    tags_str = ", ".join(tag_bits) if tag_bits else "general learner"
    traits  = ", ".join(profile.personality_traits) if profile.personality_traits else "—"
    hobbies = ", ".join(profile.hobbies)            if profile.hobbies            else "—"
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


async def run_bootstrap():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    log.info("Connecting to database...")
    pool = await get_pool()

    log.info("Fetching content items...")
    items = await fetch_content_items(pool)
    log.info("Found %d content items", len(items))

    if not items:
        log.error("No content found in database. Upload some lessons first via the teacher dashboard.")
        return

    total_combinations = len(items) * len(LEARNER_ARCHETYPES)
    log.info(
        "Will generate %d pairs (%d lessons × %d archetypes)",
        total_combinations, len(items), len(LEARNER_ARCHETYPES)
    )

    raw_pairs: List[Dict[str, Any]] = []
    done = 0

    with open(RAW_PATH, "w", encoding="utf-8") as raw_f:
        for content in items:
            for archetype in LEARNER_ARCHETYPES:
                done += 1
                log.info(
                    "[%d/%d] %s × %s",
                    done, total_combinations,
                    content["title"][:40], archetype["name"]
                )

                pair = await generate_pair(content, archetype)

                if pair:
                    raw_f.write(json.dumps(pair, ensure_ascii=False) + "\n")
                    raw_pairs.append(pair)

                # Respect Gemini rate limits
                time.sleep(GEMINI_DELAY)

    log.info("Raw pairs generated: %d", len(raw_pairs))

    # ── Quality filter ────────────────────────────────────────────────────────
    filtered = [p for p in raw_pairs if p["metadata"]["quality_score"] >= MIN_QUALITY_SCORE]
    log.info(
        "After quality filter (≥ %.1f): %d pairs kept, %d dropped",
        MIN_QUALITY_SCORE, len(filtered), len(raw_pairs) - len(filtered)
    )

    with open(FILTERED_PATH, "w", encoding="utf-8") as f:
        for pair in filtered:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")

    log.info("Saved filtered pairs → %s", FILTERED_PATH)

    # ── Push to HuggingFace Hub ───────────────────────────────────────────────
    # Auth comes from globally-cached credentials (`hf auth login`), not .env.
    from huggingface_hub import get_token

    if get_token() is None:
        log.warning(
            "Not logged in to HuggingFace — skipping Hub push.\n"
            "Run `hf auth login` with a Write token, then re-run this script."
        )
        return

    log.info("Pushing to HuggingFace Hub: %s ...", HF_REPO_ID)
    try:
        from datasets import Dataset, DatasetDict

        # Split 80 / 10 / 10
        n = len(filtered)
        train_end = int(n * 0.80)
        val_end   = int(n * 0.90)

        def to_hf(pairs):
            return Dataset.from_list([
                {"prompt": p["prompt"], "completion": p["completion"], **p["metadata"]}
                for p in pairs
            ])

        ds = DatasetDict({
            "train":      to_hf(filtered[:train_end]),
            "validation": to_hf(filtered[train_end:val_end]),
            "test":       to_hf(filtered[val_end:]),
        })

        ds.push_to_hub(HF_REPO_ID, private=True)
        log.info("✅ Dataset pushed! View it at: https://huggingface.co/datasets/%s", HF_REPO_ID)
        log.info(
            "   train=%d  validation=%d  test=%d",
            len(ds["train"]), len(ds["validation"]), len(ds["test"])
        )

    except Exception as exc:
        log.error("Hub push failed: %s", exc)
        log.info("Your filtered pairs are still saved locally at: %s", FILTERED_PATH)


if __name__ == "__main__":
    asyncio.run(run_bootstrap())
