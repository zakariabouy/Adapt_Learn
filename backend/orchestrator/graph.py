from langgraph.graph import StateGraph, END
from orchestrator.nodes import (
    profile_analysis_node,
    content_adaptation_node,
    validation_node,
    exam_generation_node,
    orientation_report_node,
)
from orchestrator.state import AgentState


def route_by_flow_type(state: AgentState) -> str:
    """
    Routes to different subgraphs based on flow_type.
    - "adapt" (default): profile → adapt → validate
    - "exam": profile → exam generation
    - "orientation": orientation report (skips profile analysis)
    """
    flow = state.get("flow_type", "adapt")
    if flow == "exam":
        return "exam_generation"
    elif flow == "orientation":
        return "orientation_report"
    return "content_adaptation"


def create_orchestrator_graph():
    workflow = StateGraph(AgentState)

    # Add all nodes
    workflow.add_node("profile_analysis", profile_analysis_node)
    workflow.add_node("content_adaptation", content_adaptation_node)
    workflow.add_node("validation", validation_node)
    workflow.add_node("exam_generation", exam_generation_node)
    workflow.add_node("orientation_report", orientation_report_node)

    # Entry: always start with profile analysis
    workflow.set_entry_point("profile_analysis")

    # After profile analysis, route based on flow_type
    workflow.add_conditional_edges(
        "profile_analysis",
        route_by_flow_type,
        {
            "content_adaptation": "content_adaptation",
            "exam_generation": "exam_generation",
            "orientation_report": "orientation_report",
        },
    )

    # Adaptation flow continues to validation
    workflow.add_edge("content_adaptation", "validation")
    workflow.add_edge("validation", END)

    # Exam and orientation go straight to END
    workflow.add_edge("exam_generation", END)
    workflow.add_edge("orientation_report", END)

    return workflow.compile()


# Singleton instance
orchestrator_app = create_orchestrator_graph()


async def adapt_content(learner_model, raw_content: str):
    """
    Runs the content adaptation flow (default).
    """
    initial_state: AgentState = {
        "learner_model": learner_model,
        "raw_content": raw_content,
        "adapted_content": "",
        "adaptation_history": [],
        "messages": [],
        "current_step": "start",
        "flow_type": "adapt",
        "content_id": None,
        "subject": None,
        "grade_level": None,
        "generated_exam": None,
        "orientation_report": None,
        "teacher_id": None,
    }

    final_state = await orchestrator_app.ainvoke(initial_state)
    return final_state["adapted_content"]


async def generate_exam_via_graph(learner_model, content_id: str, grade_level: int = 3):
    """
    Runs the exam generation flow through the orchestrator.
    Profile analysis runs first to inform exam calibration.
    """
    initial_state: AgentState = {
        "learner_model": learner_model,
        "raw_content": "",
        "adapted_content": "",
        "adaptation_history": [],
        "messages": [],
        "current_step": "start",
        "flow_type": "exam",
        "content_id": content_id,
        "subject": None,
        "grade_level": grade_level,
        "generated_exam": None,
        "orientation_report": None,
        "teacher_id": None,
    }

    final_state = await orchestrator_app.ainvoke(initial_state)
    return final_state.get("generated_exam")


async def generate_orientation_via_graph(learner_model, teacher_id: str):
    """
    Runs the orientation report flow through the orchestrator.
    """
    initial_state: AgentState = {
        "learner_model": learner_model,
        "raw_content": "",
        "adapted_content": "",
        "adaptation_history": [],
        "messages": [],
        "current_step": "start",
        "flow_type": "orientation",
        "content_id": None,
        "subject": None,
        "grade_level": None,
        "generated_exam": None,
        "orientation_report": None,
        "teacher_id": teacher_id,
    }

    final_state = await orchestrator_app.ainvoke(initial_state)
    return final_state.get("orientation_report")
