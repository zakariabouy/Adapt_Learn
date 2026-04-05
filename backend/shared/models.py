from typing import List, Dict, Optional, Any
from pydantic import BaseModel, EmailStr, Field
from enum import Enum
from datetime import datetime
from uuid import UUID

class Role(str, Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"

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

class User(UserBase):
    id: UUID
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

