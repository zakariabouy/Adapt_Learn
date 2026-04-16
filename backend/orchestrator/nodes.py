import os
import logging
import textstat
from typing import Dict, List
from uuid import UUID
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from orchestrator.state import AgentState
from shared.models import LearnerModel, ExamRequest, ExamType
from shared.log_store import orchestrator_logs
from shared.guardrails import (
    run_input_guardrails,
    run_output_guardrails,
    check_content_safety,
    filter_unsafe_content,
    check_agent_autonomy,
    log_guardrail_event,
)
from agents.adaptation.agent import simplify_text, summarize_text
from agents.exam.agent import generate_exam
from agents.orientation.agent import generate_orientation_report
from shared.rag import build_rag_context
import json

logger = logging.getLogger(__name__)

_llm = None

def get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"))
    return _llm

async def profile_analysis_node(state: AgentState):
    """
    Reads LearnerModel, decides adaptation strategy.
    """
    profile = state["learner_model"]
    orchestrator_logs.add_log("profile_analysis", f"Analyzing profile for student: {profile.student_id}", {"learning_tags": profile.learning_tags})

    prompt = f"""
    Analyze the following student learning profile and decide on an adaptation strategy for learning content.
    Profile:
    - Learning Style Tags: {profile.learning_tags}
    - Tag Strength: {profile.tag_strength}
    - Preferred Modality: {profile.preferred_modality}
    - Attention Span: {profile.chunk_size} characters per chunk

    Return a JSON object with:
    - "strategy": A brief description of the strategy.
    - "simplification_level": 0.0 to 1.0 (how much to simplify).
    - "chunk_size_override": Recommended chunk size.
    """

    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
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
    Uses RAG retrieval when content_id is available to provide
    semantically relevant context instead of raw full text.
    """
    profile = state["learner_model"]
    raw_text = state["raw_content"]
    content_id = state.get("content_id")

    orchestrator_logs.add_log("content_adaptation", "Generating adapted content via Adaptation Agent")

    # ── Guardrail: input check before adaptation ──
    input_check = await run_input_guardrails(raw_text, endpoint="orchestrator/adapt")
    if not input_check["safe"]:
        orchestrator_logs.add_log(
            "guardrails", f"Input guardrail triggered: {input_check['issues']}",
            {"action": "sanitized"}
        )
    raw_text = input_check["sanitized_text"]

    # RAG Enhancement: retrieve most relevant chunks for this student's profile
    if content_id:
        try:
            rag_query = f"Content for a {', '.join(profile.learning_tags or ['general'])} learner: {profile.preferred_modality} modality"
            rag_context = await build_rag_context(
                rag_query, UUID(content_id), top_k=6, max_context_chars=3000
            )
            if rag_context:
                orchestrator_logs.add_log(
                    "content_adaptation",
                    f"RAG: retrieved relevant chunks for content {content_id}",
                )
                raw_text = rag_context
        except Exception as e:
            logger.warning("RAG retrieval failed, using raw text: %s", e)

    # Use the Adaptation Agent's simplified text logic
    adapted_text = await simplify_text(raw_text, profile)
    
    # Memory Trimming Logic: Every 12 entries in history, summarize
    new_history = [f"Content adapted for {', '.join(profile.learning_tags)}"]
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

    orchestrator_logs.add_log("validation", "Running WCAG accessibility + guardrail checks")

    # ── Guardrail: content safety check ──
    safety = check_content_safety(adapted)
    if not safety["is_safe"]:
        orchestrator_logs.add_log(
            "guardrails",
            f"Content safety violation detected (severity={safety['severity']})",
            {"violations": len(safety["violations"])}
        )
        adapted = filter_unsafe_content(adapted)
        await log_guardrail_event(
            event_type="content_safety",
            severity=safety["severity"],
            action_taken="filtered",
            endpoint="orchestrator/validation",
            output_snippet=adapted[:500],
        )

    # Determine max acceptable grade level based on learning profile
    needs_simpler_text = any(t in profile.learning_tags for t in ["slow_reader", "short_attention", "needs_repetition"])
    max_grade_level = 6.0 if needs_simpler_text else 9.0

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


async def exam_generation_node(state: AgentState):
    """
    Generates an exam for the given content using the Exam Agent.
    Only runs when flow_type == "exam".
    """
    orchestrator_logs.add_log("exam_generation", "Starting exam generation")

    # ── Guardrail: autonomy check ──
    autonomy = check_agent_autonomy("generate_exam")
    orchestrator_logs.add_log(
        "guardrails",
        f"Autonomy check for 'generate_exam': requires_review={autonomy['requires_review']}",
    )

    content_id = state.get("content_id")
    grade_level = state.get("grade_level", 3)

    if not content_id:
        orchestrator_logs.add_log("exam_generation", "ERROR: No content_id provided")
        return {"generated_exam": None, "current_step": "end"}

    try:
        request = ExamRequest(
            content_id=content_id,
            exam_type=ExamType.mixed,
            num_questions=10,
            target_grade_level=grade_level,
        )
        exam = await generate_exam(request)
        exam_dict = exam.model_dump()

        orchestrator_logs.add_log(
            "exam_generation",
            f"Exam generated: {exam.title} ({len(exam.questions)} questions)",
            {"subject": exam.subject, "total_points": exam.total_points},
        )

        return {
            "generated_exam": exam_dict,
            "adaptation_history": [f"Exam generated: {exam.title}"],
            "current_step": "end",
        }
    except Exception as e:
        logger.error("Exam generation node failed: %s", e)
        orchestrator_logs.add_log("exam_generation", f"FAILED: {e}")
        return {"generated_exam": None, "current_step": "end"}


async def orientation_report_node(state: AgentState):
    """
    Generates an orientation report for the student using the Orientation Agent.
    Only runs when flow_type == "orientation".
    """
    orchestrator_logs.add_log("orientation_report", "Starting orientation report generation")

    # ── Guardrail: autonomy check (orientation is high-risk) ──
    autonomy = check_agent_autonomy("orientation_report")
    orchestrator_logs.add_log(
        "guardrails",
        f"Autonomy check for 'orientation_report': requires_review={autonomy['requires_review']}",
    )

    profile = state["learner_model"]
    teacher_id = state.get("teacher_id")

    if not teacher_id:
        orchestrator_logs.add_log("orientation_report", "ERROR: No teacher_id provided")
        return {"orientation_report": None, "current_step": "end"}

    try:
        report = await generate_orientation_report(
            UUID(profile.student_id), UUID(teacher_id)
        )

        orchestrator_logs.add_log(
            "orientation_report",
            f"Report generated for {report.get('student_name', 'unknown')}",
            {"strengths": report.get("data_summary", {}).get("strengths", [])},
        )

        return {
            "orientation_report": report,
            "adaptation_history": [f"Orientation report generated"],
            "current_step": "end",
        }
    except Exception as e:
        logger.error("Orientation report node failed: %s", e)
        orchestrator_logs.add_log("orientation_report", f"FAILED: {e}")
        return {"orientation_report": None, "current_step": "end"}
