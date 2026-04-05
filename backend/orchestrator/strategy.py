import os
import json
import logging
from typing import Optional, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from shared.models import AdaptationCommand, EngagementState, TelemetryEvent, LearnerModel
from shared.database import get_pool
from uuid import UUID

logger = logging.getLogger(__name__)

# Initialize Gemini
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"))

def compute_interaction_profile(profile: dict) -> dict:
    """
    Returns a dict describing the interaction effects of co-occurring
    disabilities. Used to enrich the Gemini strategy prompt.
    """
    disabilities = set(profile.get("disabilities") or [])
    severity = profile.get("severity") or {}

    notes = []
    urgency_boost = 0.0

    # Dyslexia + ADHD co-occurrence
    if "dyslexia" in disabilities and "adhd" in disabilities:
        notes.append(
            "Co-occurring dyslexia+ADHD: prioritise chunking over "
            "simplification. Use bold key terms. Avoid bullet lists longer "
            "than 3 items. Prefer switch_modality→audio when frustration>0.5."
        )
        urgency_boost += 0.2

    # Dyslexia + dyscalculia
    if "dyslexia" in disabilities and "dyscalculia" in disabilities:
        notes.append(
            "Co-occurring dyslexia+dyscalculia: avoid numeric lists. "
            "Replace numbers with words where possible. "
            "Summarise_chunk is preferred over simplify_content."
        )
        urgency_boost += 0.1

    # High severity on any single disability
    for disability, sev in severity.items():
        if sev >= 0.8:
            notes.append(
                f"Severe {disability} (severity={sev:.1f}): "
                f"immediate adaptation required — do not select no_action."
            )
            urgency_boost += 0.15

    return {
        "interaction_notes": notes,
        "urgency_boost": min(urgency_boost, 0.5)   # cap at 0.5
    }

async def get_strategic_command(
    student_id: str, 
    state: EngagementState, 
    event: TelemetryEvent,
    session_history: list = None
) -> AdaptationCommand:
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
    
    # Task 2: Multi-Disability Interaction Analysis
    interaction = compute_interaction_profile(profile)
    interaction_section = ""
    if interaction["interaction_notes"]:
        notes_str = "\n".join([f"• {note}" for note in interaction["interaction_notes"]])
        interaction_section = f"\nDisability interaction analysis:\n{notes_str}"
        if interaction["urgency_boost"] > 0:
            interaction_section += f"\nUrgency modifier: +{interaction['urgency_boost']:.2f} — bias toward active interventions."

    # Task 1: Human-readable history block
    history_block = ""
    if session_history:
        # Trim to last 5
        recent_history = session_history[-5:]
        history_lines = "\n".join([
            f"- [{i}]: {h.get('action')} (reason: {h.get('reason')})"
            for i, h in enumerate(recent_history)
        ])
        history_block = f"""
Recent adaptations already applied this session (do NOT repeat these
unless the student's state has significantly changed):
{history_lines}
"""

    prompt = f"""
    You are the Strategy Agent for AdaptLearn, an inclusive education platform.
    A student's engagement has been classified as: {state.value.upper()}
    
    Student Profile:
    - Disabilities: {profile.get('disabilities', [])}
    - Severity: {profile.get('severity', {})}
    {interaction_section}
    
    Current Telemetry:
    - Scroll Velocity: {event.scrollVelocity}
    - Click Count: {event.clickCount}
    - Time on Page: {event.timeOnPage} seconds
    - Tab Focused: {event.tabFocused}
    - Latency: {event.responseLatency}ms
    
    {history_block}
    
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
