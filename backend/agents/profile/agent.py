import os
import json
import logging
from typing import Optional
from shared.models import LearnerModel
from shared.database import get_pool
from uuid import UUID
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

logger = logging.getLogger(__name__)

_llm = None


def get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )
    return _llm


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
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()

        result = json.loads(raw)
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
