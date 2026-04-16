"""
VARK Learning Style Assessment — Child-Friendly Version (Grades 1-6)

Based on the VARK model by Neil Fleming:
  V = Visual    — learns by seeing (diagrams, charts, maps)
  A = Auditory  — learns by hearing (lectures, discussions, songs)
  R = Read/Write — learns by reading and writing (notes, lists, textbooks)
  K = Kinesthetic — learns by doing (hands-on, experiments, movement)

16 questions, each with 4 options mapped to V/A/R/K.
Scoring produces normalized 0.0-1.0 scores for each dimension.
The dominant style auto-sets preferred_modality and learning_tags.
"""

import json
import logging
from typing import Dict, List, Tuple
from uuid import UUID

from shared.database import get_pool
from shared.models import LearnerModel
from agents.profile.agent import get_student_profile, update_student_profile

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Question Bank — 16 child-friendly VARK questions
# ─────────────────────────────────────────────────────────────────────────────

VARK_QUESTIONS: List[dict] = [
    {
        "id": 1,
        "text": "When learning about a new animal, what would you like most?",
        "options": [
            {"id": "V", "label": "See pictures or a video of the animal"},
            {"id": "A", "label": "Listen to a story about the animal"},
            {"id": "R", "label": "Read a book about the animal"},
            {"id": "K", "label": "Visit a zoo and see the animal in person"},
        ],
    },
    {
        "id": 2,
        "text": "How do you remember the way to a friend's house?",
        "options": [
            {"id": "V", "label": "I picture the streets and turns in my head"},
            {"id": "A", "label": "I repeat the directions out loud to myself"},
            {"id": "R", "label": "I write down or read the directions"},
            {"id": "K", "label": "I just walk there — my feet remember!"},
        ],
    },
    {
        "id": 3,
        "text": "Your teacher is explaining how plants grow. What helps you understand best?",
        "options": [
            {"id": "V", "label": "A colorful diagram showing roots, stem, and leaves"},
            {"id": "A", "label": "The teacher explaining it step by step"},
            {"id": "R", "label": "Reading the textbook chapter about plants"},
            {"id": "K", "label": "Planting a real seed and watching it grow"},
        ],
    },
    {
        "id": 4,
        "text": "You're learning a new song. What do you do first?",
        "options": [
            {"id": "V", "label": "Watch someone perform it"},
            {"id": "A", "label": "Listen to the song several times"},
            {"id": "R", "label": "Read the lyrics on paper"},
            {"id": "K", "label": "Tap the rhythm and try to dance along"},
        ],
    },
    {
        "id": 5,
        "text": "What kind of game do you enjoy the most?",
        "options": [
            {"id": "V", "label": "Puzzles with pictures and colors"},
            {"id": "A", "label": "Games where you talk, sing, or make sounds"},
            {"id": "R", "label": "Word games, crosswords, or word searches"},
            {"id": "K", "label": "Sports, building blocks, or outdoor games"},
        ],
    },
    {
        "id": 6,
        "text": "If you need to remember something for a test, you would...",
        "options": [
            {"id": "V", "label": "Make a mind map or draw pictures"},
            {"id": "A", "label": "Say it out loud or record yourself"},
            {"id": "R", "label": "Write notes and re-read them"},
            {"id": "K", "label": "Act it out or use objects to practice"},
        ],
    },
    {
        "id": 7,
        "text": "You're building something new with LEGO. How do you start?",
        "options": [
            {"id": "V", "label": "Look at the picture on the box"},
            {"id": "A", "label": "Ask someone to tell me the steps"},
            {"id": "R", "label": "Follow the written instructions carefully"},
            {"id": "K", "label": "Just start building and figure it out!"},
        ],
    },
    {
        "id": 8,
        "text": "When your teacher tells a story, how do you follow along?",
        "options": [
            {"id": "V", "label": "I imagine the scenes like a movie in my head"},
            {"id": "A", "label": "I focus on the teacher's voice and words"},
            {"id": "R", "label": "I wish I could read along in a book"},
            {"id": "K", "label": "I want to act out what's happening"},
        ],
    },
    {
        "id": 9,
        "text": "How would you like to learn about the solar system?",
        "options": [
            {"id": "V", "label": "See a poster or video of the planets"},
            {"id": "A", "label": "Listen to a podcast or song about space"},
            {"id": "R", "label": "Read an article about each planet"},
            {"id": "K", "label": "Build a model of the solar system"},
        ],
    },
    {
        "id": 10,
        "text": "When you feel confused about something, what helps?",
        "options": [
            {"id": "V", "label": "Seeing a picture or example"},
            {"id": "A", "label": "Having someone explain it to me again"},
            {"id": "R", "label": "Reading more about it on my own"},
            {"id": "K", "label": "Trying it myself with my hands"},
        ],
    },
    {
        "id": 11,
        "text": "You're cooking with your family. How do you learn the recipe?",
        "options": [
            {"id": "V", "label": "Watch someone make it first"},
            {"id": "A", "label": "Have someone tell me the steps while I cook"},
            {"id": "R", "label": "Read the recipe from a cookbook"},
            {"id": "K", "label": "Jump in and mix ingredients right away"},
        ],
    },
    {
        "id": 12,
        "text": "Which type of homework do you enjoy the most?",
        "options": [
            {"id": "V", "label": "Drawing, coloring, or making charts"},
            {"id": "A", "label": "Talking about a topic with someone"},
            {"id": "R", "label": "Writing an essay or taking notes"},
            {"id": "K", "label": "Doing an experiment or craft project"},
        ],
    },
    {
        "id": 13,
        "text": "When you visit a museum, what do you enjoy most?",
        "options": [
            {"id": "V", "label": "Looking at displays and exhibitions"},
            {"id": "A", "label": "Listening to the audio guide"},
            {"id": "R", "label": "Reading the information labels"},
            {"id": "K", "label": "Touching interactive exhibits"},
        ],
    },
    {
        "id": 14,
        "text": "How do you prefer to show what you've learned?",
        "options": [
            {"id": "V", "label": "Make a poster or presentation with images"},
            {"id": "A", "label": "Give a talk or explain it to the class"},
            {"id": "R", "label": "Write a report or fill in a worksheet"},
            {"id": "K", "label": "Do a demonstration or build something"},
        ],
    },
    {
        "id": 15,
        "text": "You're learning math. What makes it click?",
        "options": [
            {"id": "V", "label": "Seeing the numbers on a chart or number line"},
            {"id": "A", "label": "Hearing the teacher explain the trick"},
            {"id": "R", "label": "Reading worked examples in the textbook"},
            {"id": "K", "label": "Using blocks or coins to count with"},
        ],
    },
    {
        "id": 16,
        "text": "When you get a new toy or gadget, you...",
        "options": [
            {"id": "V", "label": "Look at the pictures to see how it works"},
            {"id": "A", "label": "Ask someone to explain how it works"},
            {"id": "R", "label": "Read the instruction manual"},
            {"id": "K", "label": "Start pressing buttons and trying it out!"},
        ],
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# Scoring
# ─────────────────────────────────────────────────────────────────────────────

STYLE_LABELS = {
    "V": "Visual",
    "A": "Auditory",
    "R": "Read/Write",
    "K": "Kinesthetic",
}

STYLE_TO_MODALITY = {
    "V": "visual",
    "A": "audio",
    "R": "text",
    "K": "visual",  # kinesthetic maps closest to visual/interactive in our system
}

STYLE_TO_TAGS = {
    "V": ["visual_learner"],
    "A": ["audio_learner"],
    "R": [],  # read/write is the default, no special tag
    "K": ["gamification"],  # kinesthetic learners respond to hands-on/game activities
}


def score_vark(answers: List[Tuple[int, str]]) -> Dict[str, float]:
    """
    Score a set of VARK answers.
    answers: list of (question_id, selected_letter) where letter is V/A/R/K
    Returns: {"V": 0.0-1.0, "A": 0.0-1.0, "R": 0.0-1.0, "K": 0.0-1.0}
    """
    counts = {"V": 0, "A": 0, "R": 0, "K": 0}
    total = len(answers)

    if total == 0:
        return {"V": 0.25, "A": 0.25, "R": 0.25, "K": 0.25}

    for _, selected in answers:
        if selected in counts:
            counts[selected] += 1

    # Normalize to 0-1 (each score = count / total_questions)
    return {k: round(v / total, 3) for k, v in counts.items()}


def get_dominant_style(scores: Dict[str, float]) -> str:
    """Returns the VARK letter with the highest score. Ties broken by V > A > R > K."""
    return max(scores, key=lambda k: (scores[k], -"VARK".index(k)))


async def process_vark_submission(
    student_id: UUID,
    answers: List[Tuple[int, str]],
) -> dict:
    """
    Main entry point: scores VARK answers and updates the student's learner profile.

    Returns a VARKResult-compatible dict.
    """
    # 1. Score
    scores = score_vark(answers)
    dominant = get_dominant_style(scores)

    # 2. Get or create profile
    profile = await get_student_profile(student_id)
    if not profile:
        profile = LearnerModel(student_id=str(student_id))

    # 3. Update profile with VARK data
    profile.vark_scores = scores
    profile.vark_completed = True

    # Set preferred_modality based on dominant style
    new_modality = STYLE_TO_MODALITY[dominant]
    profile.preferred_modality = new_modality

    # Add/update learning tags based on VARK scores
    tags_updated = []
    for style, tags in STYLE_TO_TAGS.items():
        for tag in tags:
            strength = scores[style]
            # Add tag if score >= 0.3 (at least 5/16 questions chose this style)
            if strength >= 0.3:
                if tag not in profile.learning_tags:
                    profile.learning_tags.append(tag)
                profile.tag_strength[tag] = max(
                    profile.tag_strength.get(tag, 0.0),
                    round(0.4 + strength * 0.5, 3),  # maps 0.3-1.0 → 0.55-0.9
                )
                tags_updated.append(tag)
            elif strength < 0.15 and tag in profile.learning_tags:
                # Remove tag if score is very low
                profile.learning_tags.remove(tag)
                tags_updated.append(f"-{tag}")

    # 4. Save
    await update_student_profile(student_id, profile)

    # 5. Log as assessment for historical tracking
    pool = await get_pool()
    try:
        await pool.execute(
            """INSERT INTO assessments (student_id, questions, responses, score, theta_before, theta_after)
               VALUES ($1, $2, $3, $4, $5, $5)""",
            student_id,
            json.dumps({"type": "vark", "question_count": len(answers)}),
            json.dumps({"answers": [{"q": q, "a": a} for q, a in answers], "scores": scores}),
            scores[dominant],
            profile.ability_estimate,
        )
    except Exception as e:
        logger.warning("Failed to log VARK assessment: %s", e)

    return {
        "scores": scores,
        "dominant_style": dominant,
        "style_label": STYLE_LABELS[dominant],
        "profile_tags_updated": tags_updated,
        "modality_set": new_modality,
    }


def get_vark_questions() -> List[dict]:
    """Returns the full VARK questionnaire for the frontend."""
    return VARK_QUESTIONS
