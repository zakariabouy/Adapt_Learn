from typing import List, Dict, Optional, Annotated, TypedDict
from shared.models import LearnerModel
import operator


class AgentState(TypedDict):
    # The student's current learner model
    learner_model: LearnerModel
    # The original content to adapt
    raw_content: str
    # The finalized adapted content
    adapted_content: str
    # History of adaptations applied in this session
    adaptation_history: Annotated[List[str], operator.add]
    # LLM Messages
    messages: Annotated[List[Dict[str, str]], operator.add]
    # Current step tracking
    current_step: str
    # --- V2 additions ---
    # Flow type: "adapt" (default), "exam", "orientation"
    flow_type: str
    # Content metadata
    content_id: Optional[str]
    subject: Optional[str]
    grade_level: Optional[int]
    # Exam generation output (only for flow_type="exam")
    generated_exam: Optional[Dict]
    # Orientation report output (only for flow_type="orientation")
    orientation_report: Optional[Dict]
    # Teacher ID (needed for orientation reports)
    teacher_id: Optional[str]
    # Content critic review output (only for flow_type="critic")
    content_review: Optional[Dict]
