from langgraph.graph import StateGraph, END
from orchestrator.nodes import profile_analysis_node, content_adaptation_node, validation_node
from orchestrator.state import AgentState

def create_orchestrator_graph():
    # Define the graph
    workflow = StateGraph(AgentState)

    # Add Nodes
    workflow.add_node("profile_analysis", profile_analysis_node)
    workflow.add_node("content_adaptation", content_adaptation_node)
    workflow.add_node("validation", validation_node)

    # Define Edges
    workflow.set_entry_point("profile_analysis")
    workflow.add_edge("profile_analysis", "content_adaptation")
    workflow.add_edge("content_adaptation", "validation")
    workflow.add_edge("validation", END)

    # Compile
    return workflow.compile()

# Singleton instance
orchestrator_app = create_orchestrator_graph()

async def adapt_content(learner_model, raw_content: str):
    """
    Helper function to run the graph.
    """
    initial_state: AgentState = {
        "learner_model": learner_model,
        "raw_content": raw_content,
        "adapted_content": "",
        "adaptation_history": [],
        "messages": [],
        "current_step": "start"
    }
    
    final_state = await orchestrator_app.ainvoke(initial_state)
    return final_state["adapted_content"]
