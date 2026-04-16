import os
import json
import logging
from typing import Optional, List
from langchain_core.messages import HumanMessage
from shared.llm import get_rotating_llm
from shared.models import AdaptationCommand, EngagementState, TelemetryEvent, LearnerModel
from shared.database import get_pool
from shared.log_store import orchestrator_logs
from uuid import UUID

logger = logging.getLogger(__name__)


def get_llm():
    return get_rotating_llm("gemini-2.5-flash")

def compute_interaction_profile(profile: dict) -> dict:
    """
    Returns a dict describing the interaction effects of co-occurring
    learning style tags. Used to enrich the Gemini strategy prompt.
    """
    tags = set(profile.get("learning_tags") or [])
    strengths = profile.get("tag_strength") or {}

    notes = []
    urgency_boost = 0.0

    # Short attention + visual learner
    if "short_attention" in tags and "visual_learner" in tags:
        notes.append(
            "Short attention + visual learner: prioritise chunking over "
            "simplification. Use bold key terms. Avoid bullet lists longer "
            "than 3 items. Prefer switch_modality→visual when frustration>0.5."
        )
        urgency_boost += 0.2

    # Slow reader + needs repetition
    if "slow_reader" in tags and "needs_repetition" in tags:
        notes.append(
            "Slow reader + needs repetition: use shorter sentences. "
            "Summarise_chunk is preferred over simplify_content. "
            "Repeat key concepts in different wording."
        )
        urgency_boost += 0.1

    # High strength on any learning tag = strong preference
    for tag, strength in strengths.items():
        if strength >= 0.8:
            notes.append(
                f"Strong {tag} preference (strength={strength:.1f}): "
                f"immediate adaptation required — do not select no_action."
            )
            urgency_boost += 0.15

    return {
        "interaction_notes": notes,
        "urgency_boost": min(urgency_boost, 0.5)
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
    
    # Task 2: Learning Style Interaction Analysis
    interaction = compute_interaction_profile(profile)
    interaction_section = ""
    if interaction["interaction_notes"]:
        notes_str = "\n".join([f"• {note}" for note in interaction["interaction_notes"]])
        interaction_section = f"\nLearning style interaction analysis:\n{notes_str}"
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
    - Learning Tags: {profile.get('learning_tags', [])}
    - Tag Strength: {profile.get('tag_strength', {})}
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
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        # Extract JSON from response (Gemini might wrap it in ```json)
        content = response.content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        decision = json.loads(content)
        command = AdaptationCommand(
            action=decision.get("action", "no_action"),
            reason=decision.get("reason", "Strategically decided via AI"),
            data=decision.get("data", {})
        )
        orchestrator_logs.add_log(
            node="strategy_agent",
            message=f"[{state.value.upper()}] → {command.action}: {command.reason}",
            state_update={"student_id": student_id, "action": command.action, "data": command.data}
        )
        return command
    except Exception as e:
        logger.warning("Strategic command AI failed, using deterministic fallback: %s", e)
        command = fallback_command(state)
        orchestrator_logs.add_log(
            node="strategy_agent_fallback",
            message=f"[{state.value.upper()}] fallback → {command.action} (err: {e})",
            state_update={"student_id": student_id, "action": command.action}
        )
        return command

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
