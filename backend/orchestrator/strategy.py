import os
import json
import logging
from typing import Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from shared.models import AdaptationCommand, EngagementState, TelemetryEvent, LearnerModel
from shared.database import get_pool
from uuid import UUID
from orchestrator.persistence import SessionStatePersistence

logger = logging.getLogger(__name__)

# Initialize Gemini
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"))

async def get_strategic_command(student_id: str, state: EngagementState, event: TelemetryEvent) -> AdaptationCommand:
    """
    Uses Gemini to decide on the best adaptation command based on student engagement and telemetry.
    """
    # Fetch learner profile for context
    pool = await get_pool()
    profile_record = await pool.fetchrow(
        "SELECT profile_data FROM learner_profiles WHERE student_id = $1",
        UUID(student_id)
    )
    profile = json.loads(profile_record["profile_data"]) if profile_record else {}
    
    # Fetch session history for context
    session_state = await SessionStatePersistence.get_state(student_id)
    history = session_state.get("adaptation_history", []) if session_state else []
    
    prompt = f"""
    You are the Strategy Agent for AdaptLearn, an inclusive education platform.
    A student's engagement has been classified as: {state.value.upper()}
    
    Current Telemetry:
    - Scroll Velocity: {event.scrollVelocity}
    - Click Count: {event.clickCount}
    - Time on Page: {event.timeOnPage} seconds
    - Tab Focused: {event.tabFocused}
    - Latency: {event.responseLatency}ms
    
    Student Profile:
    - Disabilities: {profile.get('disabilities', [])}
    - Severity: {profile.get('severity', {})}
    
    Recent Adaptation History (Last 10 actions):
    {json.dumps(history, indent=2)}
    
    Your task:
    Decide on an adaptation action. Options:
    - "simplify_content": If student is frustrated or struggling with complexity.
    - "switch_modality": If student is distracted (audio) or bored (visual).
    - "summarize_chunk": If student is spending too much time on a chunk.
    - "no_action": If the event is minor or we just performed this action recently.
    
    Return a JSON object with:
    - "action": The action string.
    - "reason": A brief explanation of why this action was chosen.
    - "data": A dictionary of supporting parameters (e.g. {{"modality": "audio"}}).
    """
    
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        # Extract JSON from response (Gemini might wrap it in ```json)
        content = response.content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        decision = json.loads(content)
        return AdaptationCommand(
            action=decision.get("action", "no_action"),
            reason=decision.get("reason", "Strategically decided via AI"),
            data=decision.get("data", {})
        )
    except Exception as e:
        logger.warning("Strategic command AI failed, using deterministic fallback: %s", e)
        # Fallback to deterministic rules if AI fails
        return fallback_command(state)

def fallback_command(state: EngagementState) -> AdaptationCommand:
    match state:
        case EngagementState.DISTRACTED:
            return AdaptationCommand(
                action="switch_modality",
                data={"modality": "audio"},
                reason="Student appears distracted (Fallback)",
            )
        case EngagementState.FRUSTRATED:
            return AdaptationCommand(
                action="simplify_content",
                data={"reduce_chunk_size": True, "simplify_text": True},
                reason="Student appears frustrated (Fallback)",
            )
        case _:
            return AdaptationCommand(action="no_action")
