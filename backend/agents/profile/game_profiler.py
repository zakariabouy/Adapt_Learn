"""
Game-Based Profiler Agent

Analyzes results from interactive games and tests to automatically
update a student's learning tags and tag strengths.

Kids don't fill forms — they play games. Each game type reveals
different aspects of their learning style:

- Memory game → visual_learner, needs_repetition
- Speed challenge → short_attention (inverse), gamification
- Story listening → audio_learner
- Pattern matching → visual_learner
- Reading comprehension → slow_reader (inverse)
- Puzzle solving → gamification
"""

import json
import logging
from typing import Dict, List, Optional
from uuid import UUID
from datetime import datetime

from shared.database import get_pool
from shared.models import LearnerModel
from agents.profile.agent import get_student_profile, update_student_profile

logger = logging.getLogger(__name__)

# Maps game types to the learning tags they measure.
# Each entry has: tag, direction (positive = high score means tag applies),
# and weight (how much this game affects the tag).
GAME_TAG_MAP: Dict[str, List[dict]] = {
    "memory_cards": [
        {"tag": "visual_learner", "direction": "positive", "weight": 0.8},
        {"tag": "needs_repetition", "direction": "negative", "weight": 0.4},
    ],
    "speed_tap": [
        {"tag": "short_attention", "direction": "negative", "weight": 0.6},
        {"tag": "gamification", "direction": "positive", "weight": 0.7},
    ],
    "story_listen": [
        {"tag": "audio_learner", "direction": "positive", "weight": 0.9},
        {"tag": "short_attention", "direction": "negative", "weight": 0.5},
    ],
    "pattern_match": [
        {"tag": "visual_learner", "direction": "positive", "weight": 0.7},
        {"tag": "gamification", "direction": "positive", "weight": 0.3},
    ],
    "reading_race": [
        {"tag": "slow_reader", "direction": "negative", "weight": 0.8},
        {"tag": "audio_learner", "direction": "negative", "weight": 0.3},
    ],
    "puzzle_solve": [
        {"tag": "gamification", "direction": "positive", "weight": 0.8},
        {"tag": "needs_repetition", "direction": "positive", "weight": 0.4},
    ],
    "drag_and_sort": [
        {"tag": "visual_learner", "direction": "positive", "weight": 0.6},
        {"tag": "short_attention", "direction": "negative", "weight": 0.4},
    ],
    "quiz": [
        # Standard quiz — mild signal for all tags based on performance
        {"tag": "needs_repetition", "direction": "negative", "weight": 0.3},
    ],
}


def _normalize_score(raw_score: float, max_score: float) -> float:
    """Normalize a raw score to 0.0-1.0 range."""
    if max_score <= 0:
        return 0.5
    return max(0.0, min(1.0, raw_score / max_score))


def _compute_tag_updates(
    game_type: str,
    normalized_score: float,
    time_spent_seconds: float,
    max_time_seconds: float,
) -> Dict[str, float]:
    """
    Computes how much each learning tag should be adjusted based on game results.

    Returns a dict of {tag: adjustment} where adjustment is -1.0 to 1.0.
    Positive = evidence the tag applies to this student.
    Negative = evidence against the tag.
    """
    mappings = GAME_TAG_MAP.get(game_type, [])
    if not mappings:
        logger.warning("Unknown game type: %s", game_type)
        return {}

    # Time factor: did the kid spend a lot of time (patient) or rush through?
    time_ratio = time_spent_seconds / max_time_seconds if max_time_seconds > 0 else 0.5
    time_ratio = max(0.0, min(1.0, time_ratio))

    adjustments: Dict[str, float] = {}

    for mapping in mappings:
        tag = mapping["tag"]
        direction = mapping["direction"]
        weight = mapping["weight"]

        if direction == "positive":
            # High score → tag applies more
            raw_adjustment = (normalized_score - 0.5) * 2 * weight
        else:
            # High score → tag applies LESS
            raw_adjustment = (0.5 - normalized_score) * 2 * weight

        # Time modulation: rushed answers are less reliable
        reliability = 0.5 + (time_ratio * 0.5)
        raw_adjustment *= reliability

        adjustments[tag] = round(raw_adjustment, 3)

    return adjustments


async def process_game_result(
    student_id: UUID,
    game_type: str,
    raw_score: float,
    max_score: float,
    time_spent_seconds: float,
    max_time_seconds: float = 120.0,
) -> dict:
    """
    Main entry point: processes a game result and updates the student's learning profile.

    Called by the game results route (Adam builds the route).

    Returns the updated tag strengths and what changed.
    """
    # 1. Get current profile
    profile = await get_student_profile(student_id)
    if not profile:
        # Create a default profile if none exists
        profile = LearnerModel(student_id=str(student_id))

    # 2. Normalize score and compute adjustments
    normalized = _normalize_score(raw_score, max_score)
    adjustments = _compute_tag_updates(
        game_type, normalized, time_spent_seconds, max_time_seconds
    )

    if not adjustments:
        return {
            "message": "Game type not recognized",
            "tag_changes": {},
            "new_tag_strength": profile.tag_strength,
        }

    # 3. Apply adjustments to tag strengths using exponential moving average
    # This means recent games have more weight but old data isn't discarded
    LEARNING_RATE = 0.3  # How fast tags update (0.1 = slow, 0.5 = fast)

    tag_changes = {}
    for tag, adjustment in adjustments.items():
        old_strength = profile.tag_strength.get(tag, 0.5)
        # EMA: new = old + learning_rate * (signal - old)
        target = 0.5 + (adjustment / 2)  # Map adjustment to 0-1 range
        new_strength = old_strength + LEARNING_RATE * (target - old_strength)
        new_strength = round(max(0.0, min(1.0, new_strength)), 3)

        profile.tag_strength[tag] = new_strength
        tag_changes[tag] = {
            "old": old_strength,
            "new": new_strength,
            "adjustment": adjustment,
        }

        # Auto-add tag to learning_tags if strength crosses threshold
        if new_strength >= 0.4 and tag not in profile.learning_tags:
            profile.learning_tags.append(tag)
        elif new_strength < 0.25 and tag in profile.learning_tags:
            profile.learning_tags.remove(tag)

    # 4. Save updated profile
    await update_student_profile(student_id, profile)

    # 5. Log the game result for historical analysis
    pool = await get_pool()
    try:
        await pool.execute(
            """
            INSERT INTO assessments (student_id, questions, responses, score, theta_before, theta_after)
            VALUES ($1, $2, $3, $4, $5, $5)
            """,
            student_id,
            json.dumps({"game_type": game_type, "max_score": max_score}),
            json.dumps({
                "raw_score": raw_score,
                "time_spent": time_spent_seconds,
                "tag_adjustments": adjustments,
            }),
            normalized,
            profile.ability_estimate,
        )
    except Exception as e:
        logger.warning("Failed to log game result: %s", e)

    return {
        "game_type": game_type,
        "score_normalized": round(normalized, 2),
        "tag_changes": tag_changes,
        "new_tag_strength": profile.tag_strength,
        "learning_tags": profile.learning_tags,
    }


def get_available_games() -> List[dict]:
    """Returns the list of available game types and what they measure."""
    games = []
    for game_type, mappings in GAME_TAG_MAP.items():
        tags_measured = [m["tag"] for m in mappings]
        games.append({
            "game_type": game_type,
            "display_name": game_type.replace("_", " ").title(),
            "tags_measured": tags_measured,
        })
    return games
