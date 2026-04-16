from typing import List, Dict, Optional, Any
from pydantic import BaseModel, EmailStr, Field
from enum import Enum
from datetime import datetime
from uuid import UUID

class Role(str, Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"
    parent = "parent"

class EngagementState(str, Enum):
    ENGAGED = "engaged"
    NEUTRAL = "neutral"
    DISTRACTED = "distracted"
    BORED = "bored"
    FRUSTRATED = "frustrated"

# --- Authentication ---
class UserBase(BaseModel):
    email: EmailStr
    role: Role

class UserCreate(UserBase):
    password: str
    name: Optional[str] = None
    grade_level: Optional[int] = Field(default=None, ge=1, le=6)

class User(UserBase):
    id: UUID
    name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

# --- Learner Model ---
class LearnerModel(BaseModel):
    student_id: str
    learning_tags: List[str] = []
    tag_strength: Dict[str, float] = {}
    preferred_font: str = "Arial"
    font_size: int = 16
    line_spacing: float = 1.5
    color_theme: str = "light"
    preferred_modality: str = "text"
    reading_speed_wpm: int = 200
    chunk_size: int = 100
    current_engagement_score: float = 1.0
    current_frustration_level: float = 0.0
    ability_estimate: float = 0.0  # IRT theta
    mastery_by_topic: Dict[str, float] = {}
    vark_scores: Dict[str, float] = {}  # {"V": 0.0-1.0, "A": 0.0-1.0, "R": 0.0-1.0, "K": 0.0-1.0}
    vark_completed: bool = False
    # Bartle player type from games (Achiever/Explorer/Socializer/Killer)
    bartle_type: Optional[str] = None
    bartle_scores: Dict[str, float] = {}  # {"achiever": 0-1, "explorer": 0-1, "socializer": 0-1, "killer": 0-1}
    # Personal info (from parent onboarding or student self-report)
    favorite_color: Optional[str] = None
    favorite_subject: Optional[str] = None
    favorite_animal: Optional[str] = None
    hobbies: List[str] = []
    # Teacher observations
    personality_traits: List[str] = []  # ["dynamic", "shy", "curious", "leader", ...]

# --- Telemetry & Commands ---
class TelemetryEvent(BaseModel):
    studentId: str
    timestamp: int
    scrollVelocity: float
    scrollProgress: float
    clickCount: int
    tabFocused: bool
    timeOnPage: int
    event_type: str
    responseLatency: Optional[int] = None

class AdaptationCommand(BaseModel):
    action: str
    data: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None

# --- Content ---
class ContentItemBase(BaseModel):
    title: str
    original_text: str
    subject: Optional[str] = None
    grade_level: Optional[int] = None

class ContentItem(ContentItemBase):
    id: UUID
    teacher_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

# --- Quiz / IRT ---
class QuizOption(BaseModel):
    id: str
    label: str

class QuizQuestion(BaseModel):
    id: str
    text: str
    options: List[QuizOption]
    hint: Optional[str] = None
    difficulty: float = 0.0
    topic: str = ""

class QuizAnswerRequest(BaseModel):
    question_id: str
    selected_option: str
    content_id: str

class QuizAnswerResponse(BaseModel):
    is_correct: bool
    correct_id: str
    explanation: Optional[str] = None
    new_ability: float
    next_question: Optional[QuizQuestion] = None
    quiz_complete: bool = False
    score: int = 0
    total_questions: int = 0
    responses_json: str = ""

# --- Exam Generation ---
class ExamType(str, Enum):
    mcq = "mcq"
    open = "open"
    mixed = "mixed"

class ExamRequest(BaseModel):
    content_id: str
    exam_type: ExamType = ExamType.mcq
    num_questions: int = Field(default=10, ge=3, le=30)
    target_grade_level: int = Field(default=3, ge=1, le=6)

class ExamQuestion(BaseModel):
    question_number: int
    question_type: str  # "mcq" or "open"
    text: str
    options: Optional[List[QuizOption]] = None  # None for open questions
    correct_answer: str
    hint: Optional[str] = None
    explanation: str
    difficulty: float  # IRT theta
    topic: str
    points: int = 1

class GeneratedExam(BaseModel):
    title: str
    subject: str
    grade_level: int
    total_points: int
    duration_minutes: int
    instructions: str
    questions: List[ExamQuestion]

# --- Human-in-the-Loop ---
class PendingActionType(str, Enum):
    exam_generation = "exam_generation"
    orientation_report = "orientation_report"
    iep_report = "iep_report"
    content_adaptation = "content_adaptation"
    personalization = "personalization"

class PendingActionStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    modified = "modified"

class PendingAction(BaseModel):
    id: UUID
    action_type: PendingActionType
    student_id: Optional[UUID] = None
    teacher_id: UUID
    content_id: Optional[UUID] = None
    payload: Dict[str, Any]
    original_payload: Optional[Dict[str, Any]] = None
    status: PendingActionStatus
    reviewer_notes: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PendingReviewRequest(BaseModel):
    reviewer_notes: Optional[str] = Field(default=None, max_length=2000)

class PendingModifyRequest(BaseModel):
    payload: Dict[str, Any]
    reviewer_notes: Optional[str] = Field(default=None, max_length=2000)


# --- Parent Role ---
class ParentOnboardingRequest(BaseModel):
    child_email: EmailStr
    child_birth_date: Optional[str] = None          # ISO date string
    known_conditions: List[str] = []                 # e.g. ['dyslexia', 'ADHD']
    preferred_learning_time: Optional[str] = None    # 'morning', 'afternoon', 'evening'
    attention_span_minutes: Optional[int] = Field(default=None, ge=5, le=120)
    interests: List[str] = []
    languages_spoken: List[str] = []
    additional_notes: Optional[str] = None
    # Personal favorites (injected into learner profile)
    favorite_color: Optional[str] = None
    favorite_subject: Optional[str] = None
    favorite_animal: Optional[str] = None
    hobbies: List[str] = []
    personality_observations: List[str] = []         # parent-observed: ['shy', 'curious', 'energetic']

class ParentalControlsRequest(BaseModel):
    daily_time_limit_minutes: int = Field(default=60, ge=15, le=480)
    session_max_minutes: int = Field(default=45, ge=10, le=120)
    allowed_start_hour: int = Field(default=8, ge=0, le=23)
    allowed_end_hour: int = Field(default=20, ge=0, le=23)
    break_interval_minutes: int = Field(default=45, ge=10, le=120)
    break_duration_minutes: int = Field(default=10, ge=5, le=30)
    allow_leaderboard: bool = True
    allow_messaging: bool = False

class CustomRewardRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    xp_cost: int = Field(..., gt=0, le=10000)
    icon: str = "gift"

class LinkChildRequest(BaseModel):
    child_email: EmailStr
    relationship: str = "parent"


# --- Feedback ---
class StudentFeedbackRequest(BaseModel):
    session_id: Optional[str] = None
    content_id: Optional[str] = None
    content_rating: Optional[int] = Field(default=None, ge=1, le=5)
    teacher_rating: Optional[int] = Field(default=None, ge=1, le=5)
    difficulty_feedback: Optional[str] = None   # 'too_easy', 'just_right', 'too_hard'
    comment: Optional[str] = Field(default=None, max_length=1000)

class ParentIssueRequest(BaseModel):
    child_id: str
    issue_type: str     # 'assessment_disagree', 'content_complaint', etc.
    target_id: Optional[str] = None
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10, max_length=5000)


# --- Communication ---
class SendMessageRequest(BaseModel):
    recipient_id: str
    subject: Optional[str] = None
    body: str = Field(..., min_length=1, max_length=5000)
    parent_message_id: Optional[str] = None   # for threading


# --- Teacher Enhancements ---
class ClassroomRewardRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    xp_cost: int = Field(..., gt=0, le=10000)
    icon: str = "star"

class TeacherCorrectionRequest(BaseModel):
    student_id: str
    correction_type: str    # 'profile_override', 'behavior_note', 'attention_span', 'tag_adjustment'
    data: Dict[str, Any]

class RedeemRewardRequest(BaseModel):
    reward_id: str
    reward_type: str = "classroom"  # 'custom' or 'classroom'


# --- Anti-Addiction ---
class SessionCheckResponse(BaseModel):
    allowed: bool
    reason: Optional[str] = None
    remaining_minutes: Optional[float] = None
    break_required: bool = False
    locked_until: Optional[str] = None


# --- VARK Test ---
class VARKAnswer(BaseModel):
    question_id: int = Field(..., ge=1, le=16)
    selected: str = Field(..., pattern=r'^[VARK]$')

class VARKSubmitRequest(BaseModel):
    answers: List[VARKAnswer] = Field(..., min_length=16, max_length=16)

class VARKResult(BaseModel):
    scores: Dict[str, float]          # {"V": 0.0-1.0, "A": ..., "R": ..., "K": ...}
    dominant_style: str                # "V", "A", "R", or "K"
    style_label: str                   # "Visual", "Auditory", etc.
    profile_tags_updated: List[str]    # tags that were added/changed
    modality_set: str                  # the preferred_modality that was auto-set

