"""
Orientation Report Schema — Pydantic models for Gemini Structured Outputs.

Two-axis personality model:
  - Dispersion axis: Scanner (broad curiosity) vs Diver (deep specialist)
  - Affinity axis: 4 cognitive archetypes

The schema enforces strict structure so Gemini cannot deviate
from the expected format or mention specific careers.
"""

from pydantic import BaseModel, Field
from typing import Literal
from enum import Enum


class DispersionType(str, Enum):
    SCANNER = "scanner"
    DIVER = "diver"
    BALANCED = "balanced"


class AffinityArchetype(str, Enum):
    INVESTIGATOR = "investigator"
    CREATOR = "creator"
    PRAGMATIC = "pragmatic"
    SOCIAL = "social"


class BartleType(str, Enum):
    ACHIEVER = "achiever"
    EXPLORER = "explorer"
    SOCIALIZER = "socializer"
    CHALLENGER = "challenger"


# ─────────────────────────────────────────────────────────────────────────────
# Sub-models
# ─────────────────────────────────────────────────────────────────────────────

class DispersionAnalysis(BaseModel):
    type: DispersionType = Field(
        description="Scanner = broadly curious with homogeneous scores across subjects. "
                    "Diver = hyper-focused specialist with one dominant area. "
                    "Balanced = moderate spread with slight preference."
    )
    index: float = Field(
        ge=0.0, le=1.0,
        description="0.0 = perfectly homogeneous (pure Scanner), "
                    "1.0 = maximally concentrated (pure Diver). "
                    "Use the pre-computed value from the input data."
    )
    evidence: str = Field(
        description="One sentence citing specific subject scores or engagement patterns "
                    "that justify this classification. Must reference actual data."
    )


class AffinityScore(BaseModel):
    archetype: AffinityArchetype = Field(description="One of the four cognitive archetypes.")
    score: float = Field(
        ge=0.0, le=1.0,
        description="Affinity score from 0 (no signal) to 1 (strong signal). "
                    "Derived from cross-referencing VARK, IRT scores, interests, and engagement."
    )
    signals: list[str] = Field(
        min_length=1, max_length=4,
        description="Concrete data points that contribute to this score. "
                    "Example: 'High theta in math (1.4)', 'Parent reports Lego hobby', "
                    "'Kinesthetic VARK dominant'."
    )


class ArchetypeResult(BaseModel):
    primary: AffinityArchetype = Field(
        description="The dominant cognitive archetype for this child."
    )
    secondary: AffinityArchetype = Field(
        description="The second strongest archetype. Must differ from primary."
    )
    affinity_scores: list[AffinityScore] = Field(
        min_length=4, max_length=4,
        description="Scores for all four archetypes, ordered by score descending."
    )
    narrative: str = Field(
        description="2-3 sentences describing the child's cognitive personality "
                    "in warm, encouraging language suitable for parents. "
                    "NEVER mention specific jobs or careers."
    )


class RewardSuggestion(BaseModel):
    title: str = Field(
        description="Short reward name, concrete and exciting for a child. "
                    "Example: 'Kit de construction Lego Technic', 'Carnet de croquis professionnel'."
    )
    description: str = Field(
        description="1-2 sentences explaining why this reward fits this specific child, "
                    "referencing their archetype and interests. Written for the parent."
    )
    archetype_alignment: AffinityArchetype = Field(
        description="Which archetype this reward nurtures."
    )
    bartle_alignment: BartleType = Field(
        description="Which Bartle player type this reward appeals to."
    )
    xp_cost: int = Field(
        ge=50, le=1000,
        description="Suggested XP cost to 'unlock' this reward in the gamification system. "
                    "Higher for more valuable rewards."
    )
    real_world_budget: Literal["low", "medium", "high"] = Field(
        description="Approximate real-world cost bracket. "
                    "low = free or under 50 MAD, medium = 50-150 MAD, high = 150-300 MAD."
    )


class PsychometricSummary(BaseModel):
    irt_summary: str = Field(
        description="One sentence summarizing the child's IRT ability level and trajectory. "
                    "Example: 'Theta of 0.8 with upward trend — above average for Grade 3.'"
    )
    attention_profile: str = Field(
        description="One sentence about attention span and frustration patterns "
                    "from telemetry data."
    )
    vark_dominant: str = Field(
        description="The child's dominant VARK modality and how it manifests in their learning."
    )
    bartle_type: BartleType = Field(
        description="Inferred Bartle player type from gamification behavior."
    )
    bartle_evidence: str = Field(
        description="One sentence justifying the Bartle classification "
                    "with specific behavioral data."
    )


class GrowthArea(BaseModel):
    area: str = Field(
        description="A specific skill or domain where the child can grow. "
                    "Example: 'Sustained reading focus', 'Collaborative problem-solving'."
    )
    current_level: Literal["emerging", "developing", "established"] = Field(
        description="Where the child currently stands in this area."
    )
    suggestion: str = Field(
        description="One concrete, actionable suggestion for parents to support growth. "
                    "Must be age-appropriate and encouraging."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Top-level report
# ─────────────────────────────────────────────────────────────────────────────

class OrientationReportSchema(BaseModel):
    student_name: str = Field(description="The child's first name, used for personalization.")
    grade_level: int = Field(ge=1, le=6, description="Current grade level (1-6).")

    psychometric_summary: PsychometricSummary = Field(
        description="Aggregated psychometric profile from IRT, telemetry, VARK, and gamification."
    )

    dispersion: DispersionAnalysis = Field(
        description="Scanner vs Diver classification on the dispersion axis."
    )

    archetype: ArchetypeResult = Field(
        description="Cognitive archetype classification on the affinity axis."
    )

    reward_suggestions: list[RewardSuggestion] = Field(
        min_length=3, max_length=5,
        description="Personalized reward suggestions that align with the child's "
                    "archetype AND Bartle type. Each reward must nurture the child's "
                    "natural inclinations."
    )

    growth_areas: list[GrowthArea] = Field(
        min_length=2, max_length=4,
        description="Areas where the child can develop, with actionable parent suggestions."
    )

    parent_message: str = Field(
        description="A warm 3-4 sentence message addressed directly to the parents, "
                    "summarizing their child's unique profile and encouraging them. "
                    "Must be positive and forward-looking. NEVER mention careers or jobs."
    )
