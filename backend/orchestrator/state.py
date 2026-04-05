from typing import List, Dict, Annotated, TypedDict
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
    # Current chunk index or tracking
    current_step: str
