import os
import json
import logging
from typing import Optional
from shared.models import LearnerModel
from shared.database import get_pool
from shared.guardrails import run_output_guardrails, validate_json_output
from uuid import UUID
from langchain_core.messages import HumanMessage

from shared.llm import get_rotating_llm

logger = logging.getLogger(__name__)


def get_llm():
    return get_rotating_llm("gemini-2.5-flash")


async def get_student_profile(student_id: UUID) -> Optional[LearnerModel]:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT profile_data FROM learner_profiles WHERE student_id = $1",
        student_id
    )
    if row:
        data = json.loads(row["profile_data"])
        return LearnerModel(**data)
    return None

async def update_student_profile(student_id: UUID, profile: LearnerModel):
    pool = await get_pool()
    profile_json = profile.model_dump_json()
    
    # Upsert the profile
    await pool.execute(
        """
        INSERT INTO learner_profiles (student_id, profile_data, last_updated)
        VALUES ($1, $2, NOW())
        ON CONFLICT (student_id) DO UPDATE
        SET profile_data = EXCLUDED.profile_data,
            last_updated = NOW()
        """,
        student_id, profile_json
    )
    return profile


# ─────────────────────────────────────────────────────────────────────────────
# Agent 1 — Profiler
# Fuses three input sources into a single LearnerModel:
#   1. Parent  — parent_onboarding (home behavior, interests, conditions)
#   2. Teacher — teacher_observations (class behavior, notes)
#   3. Child   — existing learner_profiles row (VARK, games, IRT ability)
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_parent_inputs(student_id: UUID) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT known_conditions, preferred_learning_time, attention_span_minutes,
               interests, languages_spoken, additional_notes, favorite_color,
               favorite_subject, favorite_animal, hobbies, personality_observations
        FROM parent_onboarding WHERE child_id = $1
        ORDER BY updated_at DESC LIMIT 1
        """,
        student_id,
    )
    return dict(row) if row else {}


async def _fetch_teacher_inputs(student_id: UUID) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT notes, updated_at FROM teacher_observations
        WHERE student_id = $1 ORDER BY updated_at DESC LIMIT 1
        """,
        student_id,
    )
    return dict(row) if row else {}


async def _fetch_child_kpis(student_id: UUID) -> dict:
    """Child KPIs = existing VARK/Bartle/IRT signals captured from games + quiz."""
    existing = await get_student_profile(student_id)
    if not existing:
        return {}
    return {
        "vark_scores": existing.vark_scores,
        "vark_completed": existing.vark_completed,
        "bartle_type": existing.bartle_type,
        "bartle_scores": existing.bartle_scores,
        "ability_estimate": existing.ability_estimate,
        "reading_speed_wpm": existing.reading_speed_wpm,
        "chunk_size": existing.chunk_size,
        "mastery_by_topic": existing.mastery_by_topic,
    }


def _heuristic_merge(
    parent: dict, teacher: dict, child: dict, existing: Optional[LearnerModel]
) -> LearnerModel:
    """
    Deterministic fallback when the LLM is unavailable. Merges the three
    sources into a LearnerModel using rules — guarantees Agent 1 always
    produces output even with zero Gemini quota.
    """
    base = existing.model_dump() if existing else {}
    base.setdefault("student_id", "")

    # Parent-driven preferences
    if parent:
        if parent.get("attention_span_minutes"):
            # Convert minutes → chunk_size characters (≈ 200 wpm × 5 chars/word)
            base["chunk_size"] = max(60, int(parent["attention_span_minutes"]) * 60)
        if parent.get("favorite_color"):
            base["favorite_color"] = parent["favorite_color"]
        if parent.get("favorite_subject"):
            base["favorite_subject"] = parent["favorite_subject"]
        if parent.get("favorite_animal"):
            base["favorite_animal"] = parent["favorite_animal"]
        if parent.get("hobbies"):
            base["hobbies"] = list(parent["hobbies"])

        # Known conditions map to learning tags
        tags = set(base.get("learning_tags", []))
        for cond in parent.get("known_conditions") or []:
            cond_low = cond.lower()
            if "dyslex" in cond_low or "slow_read" in cond_low:
                tags.add("slow_reader")
            if "adhd" in cond_low or "attention" in cond_low:
                tags.add("short_attention")
            if "autism" in cond_low:
                tags.add("needs_repetition")
        base["learning_tags"] = list(tags)

    # Teacher-driven personality (free-text → keyword extraction)
    if teacher and teacher.get("notes"):
        notes = teacher["notes"].lower()
        traits = set(base.get("personality_traits", []))
        for keyword, trait in [
            ("shy", "shy"), ("curious", "curious"), ("lead", "leader"),
            ("quiet", "quiet"), ("active", "dynamic"), ("creative", "creative"),
        ]:
            if keyword in notes:
                traits.add(trait)
        base["personality_traits"] = list(traits)

    # Child KPIs — VARK → preferred_modality
    if child.get("vark_scores"):
        v = child["vark_scores"]
        if v:
            top = max(v.items(), key=lambda kv: kv[1])[0]
            base["preferred_modality"] = {
                "V": "visual", "A": "audio", "R": "text", "K": "kinesthetic"
            }.get(top, "text")
            if top == "V" and "visual_learner" not in base.get("learning_tags", []):
                base.setdefault("learning_tags", []).append("visual_learner")
            if top == "A" and "audio_learner" not in base.get("learning_tags", []):
                base.setdefault("learning_tags", []).append("audio_learner")

    return LearnerModel(**base)


async def build_profile_from_three_sources(student_id: UUID) -> LearnerModel:
    """
    Agent 1 — Profiler. Aggregates parent + teacher + child inputs into a
    LearnerModel. Uses Gemini to enrich tag_strength and personality_traits
    when available; falls back to a deterministic heuristic merge otherwise.
    Always persists the result to learner_profiles.
    """
    parent_inputs = await _fetch_parent_inputs(student_id)
    teacher_inputs = await _fetch_teacher_inputs(student_id)
    child_inputs = await _fetch_child_kpis(student_id)
    existing = await get_student_profile(student_id)

    # Start with the heuristic merge — this is the guaranteed-correct baseline.
    profile = _heuristic_merge(parent_inputs, teacher_inputs, child_inputs, existing)
    profile.student_id = str(student_id)

    # Try to enrich via LLM; on any failure, keep the heuristic result.
    try:
        context = {
            "parent_inputs": {k: v for k, v in parent_inputs.items() if v},
            "teacher_inputs": {k: str(v) for k, v in teacher_inputs.items() if v},
            "child_kpis": {k: v for k, v in child_inputs.items() if v},
            "current_profile": profile.model_dump(mode="json"),
        }
        prompt = f"""You are a child learning profiler. Given the three input sources
below, refine the student's LearnerModel. Focus on:
  - tag_strength (0.0-1.0) for each learning_tag
  - personality_traits (short list of adjectives from teacher notes)
  - preferred_modality ("visual", "audio", "text", "kinesthetic")

Return ONLY a valid JSON object matching this schema (only include fields you
want to change — other fields will be preserved):
{{
  "learning_tags": ["..."],
  "tag_strength": {{"tag_name": 0.0-1.0}},
  "personality_traits": ["..."],
  "preferred_modality": "visual|audio|text|kinesthetic"
}}

## Inputs
```json
{json.dumps(context, ensure_ascii=False, default=str)}
```"""

        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        raw = response.content.strip()
        # Strip ```json fences if present
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1].lstrip("json\n").strip()
            if raw.endswith("```"):
                raw = raw.rsplit("```", 1)[0].strip()

        check = validate_json_output(raw, required_keys=[])
        if check["valid"]:
            enriched = check["parsed"]
            base = profile.model_dump()
            for key in ("learning_tags", "tag_strength", "personality_traits", "preferred_modality"):
                if key in enriched and enriched[key]:
                    base[key] = enriched[key]
            profile = LearnerModel(**base)
            logger.info("Agent 1 (Profiler) LLM enrichment applied for %s", student_id)
        else:
            logger.warning("Agent 1 LLM returned invalid JSON, keeping heuristic merge")
    except Exception as e:
        logger.warning("Agent 1 LLM unavailable (%s); using heuristic merge only", e)

    # Persist
    await update_student_profile(student_id, profile)
    return profile


async def generate_profile_summary(student_id: UUID) -> dict:
    """
    Generates a fun, kid-friendly description of the student's learning profile.
    Returns cached version if available, otherwise calls Gemini.
    """
    pool = await get_pool()

    # Check cache: stored as a special iep_report with week = 'profile-summary'
    cached = await pool.fetchrow(
        "SELECT report_data FROM iep_reports WHERE student_id = $1 AND week = 'profile-summary' ORDER BY generated_at DESC LIMIT 1",
        student_id,
    )
    if cached:
        data = json.loads(cached["report_data"]) if isinstance(cached["report_data"], str) else cached["report_data"]
        return data

    # Fetch profile
    profile = await get_student_profile(student_id)
    if not profile:
        return {
            "title": "New Explorer!",
            "emoji": "🌟",
            "summary": "Welcome! Complete your learning profile to discover your superpower!",
            "strengths": [],
            "fun_fact": "Every great learner starts with curiosity!",
        }

    # Build tag descriptions
    tag_labels = {
        "visual_learner": "Visual Explorer",
        "short_attention": "Speed Learner",
        "slow_reader": "Deep Thinker",
        "audio_learner": "Sound Wizard",
        "needs_repetition": "Practice Champion",
        "gamification": "Game Master",
    }

    tags_with_strength = []
    for tag in profile.learning_tags:
        strength = profile.tag_strength.get(tag, 0.5)
        label = tag_labels.get(tag, tag.replace("_", " ").title())
        tags_with_strength.append(f"{label} (strength: {strength:.0%})")

    prompt = f"""You are writing a fun profile card for a primary school student (ages 6-12).

STUDENT'S LEARNING PROFILE:
- Learning styles: {', '.join(tags_with_strength) or 'Not yet determined'}
- Preferred way to learn: {profile.preferred_modality}
- Reading speed: {profile.reading_speed_wpm} words per minute
- Focus duration: {(profile.chunk_size or 100) // 10} minutes

Generate a JSON response with:
{{
  "title": "A fun 2-3 word title like 'Visual Explorer!' or 'Sound Wizard!'",
  "emoji": "One emoji that represents their learning style",
  "summary": "A 2-3 sentence fun, encouraging description written FOR the child. Use 'you' and 'your'. Simple words. Example: 'You learn best when you can SEE things! Pictures, colors, and diagrams are your superpower. You remember things by looking at them!'",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "fun_fact": "A fun fact about their learning style that makes them feel special"
}}

RULES:
- Write for a child aged 6-12
- Be VERY encouraging and positive
- Use simple words and short sentences
- Make the child feel proud of their learning style
- No negative language ever
- Return ONLY valid JSON"""

    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        raw = response.content.strip()

        # Structured output validation
        json_check = validate_json_output(raw, required_keys=["title", "summary"])
        if json_check["valid"]:
            result = json_check["parsed"]
        else:
            logger.warning("Profile summary JSON invalid: %s", json_check["errors"])
            raise ValueError("Invalid JSON from Gemini")

        # Output content safety
        output_check = await run_output_guardrails(
            result.get("summary", "") + " " + result.get("fun_fact", ""),
            endpoint="profile/summary",
        )
        if not output_check["safe"]:
            result["summary"] = output_check["filtered_text"]

    except Exception as e:
        logger.warning("Profile summary generation failed: %s", e)
        primary_tag = profile.learning_tags[0] if profile.learning_tags else "learner"
        label = tag_labels.get(primary_tag, "Super Learner")
        result = {
            "title": f"{label}!",
            "emoji": "🌟",
            "summary": f"You are a {label}! You have your own special way of learning, and that makes you amazing!",
            "strengths": [tag_labels.get(t, t) for t in profile.learning_tags[:3]],
            "fun_fact": "Everyone learns differently, and your way is awesome!",
        }

    # Cache the result
    try:
        await pool.execute(
            "INSERT INTO iep_reports (student_id, teacher_id, report_data, week) VALUES ($1, $1, $2, 'profile-summary')",
            student_id,
            json.dumps(result),
        )
    except Exception as e:
        logger.warning("Failed to cache profile summary: %s", e)

    return result
