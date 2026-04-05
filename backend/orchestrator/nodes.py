import os
import logging
import textstat
from typing import Dict, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from orchestrator.state import AgentState
from shared.models import LearnerModel
from shared.log_store import orchestrator_logs
from agents.adaptation.agent import simplify_text, summarize_text
import json

logger = logging.getLogger(__name__)

# Initialize Gemini
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"))

async def profile_analysis_node(state: AgentState):
    """
    Reads LearnerModel, decides adaptation strategy.
    """
    profile = state["learner_model"]
    orchestrator_logs.add_log("profile_analysis", f"Analyzing profile for student: {profile.student_id}", {"disabilities": profile.disabilities})
    
    prompt = f"""
    Analyze the following student profile and decide on an adaptation strategy for learning content.
    Profile:
    - Disabilities: {profile.disabilities}
    - Severity: {profile.severity}
    - Preferred Modality: {profile.preferred_modality}
    - Attention Span: {profile.chunk_size} characters per chunk
    
    Return a JSON object with:
    - "strategy": A brief description of the strategy.
    - "simplification_level": 0.0 to 1.0 (how much to simplify).
    - "chunk_size_override": Recommended chunk size.
    """
    
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        strategy_info = response.content
    except Exception as e:
        logger.warning("Gemini profile analysis failed, using default strategy: %s", e)
        strategy_info = '{"strategy": "Default readability enhancement", "simplification_level": 0.5}'
    
    orchestrator_logs.add_log("profile_analysis", "Strategy decision finalized", {"strategy": strategy_info})
    
    return {
        "adaptation_history": [f"Strategy analysis complete: {strategy_info}"],
        "current_step": "adaptation"
    }

async def content_adaptation_node(state: AgentState):
    """
    Calls Adaptation Agent to rewrite content per strategy.
    """
    profile = state["learner_model"]
    raw_text = state["raw_content"]
    
    orchestrator_logs.add_log("content_adaptation", "Generating adapted content via Adaptation Agent")
    
    # Use the Adaptation Agent's simplified text logic
    adapted_text = await simplify_text(raw_text, profile)
    
    # Memory Trimming Logic: Every 12 entries in history, summarize
    new_history = [f"Content adapted for {', '.join(profile.disabilities)}"]
    if len(state["adaptation_history"]) >= 12:
        orchestrator_logs.add_log("memory_trimming", "Context limit reached. Summarizing history.")
        # Use the agent's summarizer for the history too
        summary = await summarize_text(str(state["adaptation_history"]))
        new_history = [f"HISTORY SUMMARY: {summary}"]

    orchestrator_logs.add_log("content_adaptation", "Adaptation cycle complete")

    return {
        "adapted_content": adapted_text,
        "adaptation_history": new_history,
        "current_step": "validation"
    }

async def validation_node(state: AgentState):
    """
    Validates adapted content against WCAG-inspired accessibility rules:
    - Flesch-Kincaid grade level should not exceed the student's target
    - Content length should not exceed 3x the configured chunk_size
    """
    adapted = state["adapted_content"]
    profile = state["learner_model"]

    orchestrator_logs.add_log("validation", "Running WCAG accessibility checks")

    # Determine max acceptable grade level based on disabilities
    has_reading_disability = any(d in profile.disabilities for d in ["dyslexia", "adhd", "dyscalculia"])
    max_grade_level = 6.0 if has_reading_disability else 9.0

    grade_level = textstat.flesch_kincaid_grade(adapted)
    max_chunk = (profile.chunk_size or 500) * 3

    issues = []
    if grade_level > max_grade_level:
        issues.append(f"readability grade {grade_level:.1f} > target {max_grade_level}")
    if len(adapted) > max_chunk:
        issues.append(f"content length {len(adapted)} chars > 3× chunk_size {profile.chunk_size or 500}")

    if issues:
        logger.warning("WCAG validation warnings for student %s: %s", profile.student_id, "; ".join(issues))
        orchestrator_logs.add_log(
            "validation",
            f"WCAG warnings detected: {'; '.join(issues)}",
            {"grade_level": round(grade_level, 1), "issues": issues}
        )
    else:
        orchestrator_logs.add_log(
            "validation",
            "Content verified — WCAG checks passed",
            {"grade_level": round(grade_level, 1), "content_length": len(adapted)}
        )

    return {
        "adaptation_history": [f"Validation: grade={grade_level:.1f}, issues={issues or 'none'}"],
        "current_step": "end"
    }
