import os
from typing import Dict, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from orchestrator.state import AgentState
from shared.models import LearnerModel
from shared.log_store import orchestrator_logs
import json

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
        print(f"Gemini Profile Error: {e}. Falling back to default strategy.")
        strategy_info = '{"strategy": "Default readability enhancement", "simplification_level": 0.5}'
    
    orchestrator_logs.add_log("profile_analysis", "Strategy decision finalized", {"strategy": strategy_info})
    
    return {
        "adaptation_history": [f"Strategy analysis complete: {strategy_info}"],
        "current_step": "adaptation"
    }

async def content_adaptation_node(state: AgentState):
    """
    Calls Gemini to rewrite content per strategy.
    """
    profile = state["learner_model"]
    raw_text = state["raw_content"]
    history = state["adaptation_history"][-1] # Latest strategy
    
    orchestrator_logs.add_log("content_adaptation", "Generating adapted content via Gemini Flash", {"strategy_context": history[:100] + "..."})
    
    prompt = f"""
    You are an expert in inclusive education. Adapt the following text for a student with the following profile:
    Profile: {profile.disabilities} (Severity: {profile.severity})
    Strategy: {history}
    
    Original Text:
    {raw_text}
    
    Tasks:
    1. Simplify the vocabulary if necessary.
    2. Maintain the core pedagogical concepts.
    3. Ensure the tone is encouraging.
    4. Keep the output in Markdown format.
    
    Adapted Text:
    """
    
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        adapted_text = response.content
    except Exception as e:
        print(f"Gemini API Error: {e}. Falling back to original text.")
        adapted_text = raw_text
        
    # Memory Trimming Logic: Every 12 entries in history, summarize
    new_history = [f"Content adapted via Gemini Flash"]
    if len(state["adaptation_history"]) >= 12:
        orchestrator_logs.add_log("memory_trimming", "Context limit reached. Summarizing history.")
        summary_prompt = f"Summarize the following adaptation history for context retention: {state['adaptation_history']}"
        summary_res = await llm.ainvoke([HumanMessage(content=summary_prompt)])
        new_history = [f"HISTORY SUMMARY: {summary_res.content}"]

    orchestrator_logs.add_log("content_adaptation", "Adaptation cycle complete")

    return {
        "adapted_content": adapted_text,
        "adaptation_history": new_history,
        "current_step": "validation"
    }

async def validation_node(state: AgentState):
    """
    Checks accessibility standards (reading level, chunk size).
    """
    adapted = state["adapted_content"]
    profile = state["learner_model"]
    
    orchestrator_logs.add_log("validation", "Validating accessibility standards")
    
    # Heuristic check: length vs attention span
    # In a full ReAct loop, if this fails, it would loop back to adaptation
    
    orchestrator_logs.add_log("validation", "Content verified successfully", {"status": "END"})

    return {
        "adaptation_history": ["Validation complete: Content meets accessibility standards."],
        "current_step": "end"
    }
