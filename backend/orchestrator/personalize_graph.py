"""
Personalize Pipeline — the real three-agent LangGraph.

This is the graph that justifies using LangGraph at all. It exercises four
primitives that a plain async chain cannot express cleanly:

  1. Parallel fan-out / fan-in   → three input fetchers run concurrently
                                    (parent, teacher, child), then the
                                    profiler merges them.
  2. Cycle                        → if the critic rejects the personalization,
                                    we loop back to the personalizer with the
                                    critic report in context, up to
                                    MAX_PERSONALIZE_RETRIES times.
  3. Conditional edges            → the critic's `recommend_approve` flag
                                    routes to either the retry cycle or the
                                    HITL enqueue node.
  4. Checkpointed state           → MemorySaver persists state across
                                    resumes within the process, so a failed
                                    LLM call can be retried without
                                    re-running the whole pipeline.

Shape:

    [fetch_parent ─┐
     fetch_teacher ─┼─► profiler ─► personalizer ─► critic ─┬─► hitl_enqueue ─► END
     fetch_child  ─┘                     ▲                  │
                                         │   (if reject &   │
                                         └───  < max tries) │
                                                            └─► (set retry → personalizer)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Annotated, TypedDict
from uuid import UUID
import operator

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from agents.profile.agent import (
    _fetch_parent_inputs,
    _fetch_teacher_inputs,
    _fetch_child_kpis,
    _heuristic_merge,
    get_student_profile,
    update_student_profile,
)
from agents.personalizer.agent import personalize_content, fetch_recent_feedback
from agents.fidelity_critic.agent import review_personalization
from shared.database import get_pool
from shared.models import LearnerModel
from shared.pending import enqueue_pending_action
from shared.log_store import orchestrator_logs

logger = logging.getLogger(__name__)

MAX_PERSONALIZE_RETRIES = 2  # critic-driven retries before escalating to HITL


# ─────────────────────────────────────────────────────────────────────────────
# State
# ─────────────────────────────────────────────────────────────────────────────

class PersonalizeState(TypedDict, total=False):
    # Inputs (required)
    student_id: str
    content_id: str
    teacher_id: str

    # Parallel-branch outputs (fan-in merges these)
    parent_inputs: Dict[str, Any]
    teacher_inputs: Dict[str, Any]
    child_inputs: Dict[str, Any]

    # Content payload (loaded once)
    original_text: str
    content_title: str
    content_subject: str
    content_grade_level: int

    # Agent 1 output
    profile: LearnerModel

    # Agent 2 output (may be overwritten on retry)
    bundle: Dict[str, Any]         # {child_content, quiz, parent_summary}
    recent_feedback: List[Dict[str, Any]]

    # Agent 3 output
    critic_report: Dict[str, Any]

    # Retry bookkeeping
    retry_count: int
    events: Annotated[List[str], operator.add]   # append-only log

    # Terminal
    pending_action_id: Optional[str]


# ─────────────────────────────────────────────────────────────────────────────
# Parallel input fetchers (Agent 1 inputs)
# ─────────────────────────────────────────────────────────────────────────────

async def fetch_parent_node(state: PersonalizeState) -> Dict[str, Any]:
    sid = UUID(state["student_id"])
    data = await _fetch_parent_inputs(sid)
    orchestrator_logs.add_log("profiler", f"parent inputs fetched ({len(data)} fields)")
    return {"parent_inputs": data, "events": ["parent_inputs:fetched"]}


async def fetch_teacher_node(state: PersonalizeState) -> Dict[str, Any]:
    sid = UUID(state["student_id"])
    data = await _fetch_teacher_inputs(sid)
    orchestrator_logs.add_log("profiler", f"teacher observations fetched ({len(data)} fields)")
    return {"teacher_inputs": data, "events": ["teacher_inputs:fetched"]}


async def fetch_child_node(state: PersonalizeState) -> Dict[str, Any]:
    sid = UUID(state["student_id"])
    data = await _fetch_child_kpis(sid)
    orchestrator_logs.add_log("profiler", f"child KPIs fetched ({len(data)} signals)")
    return {"child_inputs": data, "events": ["child_inputs:fetched"]}


async def load_content_node(state: PersonalizeState) -> Dict[str, Any]:
    """Load the teacher content + recent feedback once, in parallel with inputs."""
    pool = await get_pool()
    cid = UUID(state["content_id"])
    sid = UUID(state["student_id"])

    row = await pool.fetchrow(
        "SELECT title, original_text, subject, grade_level FROM content_items WHERE id = $1",
        cid,
    )
    if not row:
        raise ValueError(f"content_id {state['content_id']} not found")

    recent = await fetch_recent_feedback(sid, cid)

    return {
        "original_text": row["original_text"],
        "content_title": row["title"],
        "content_subject": row["subject"] or "General",
        "content_grade_level": row["grade_level"] or 3,
        "recent_feedback": recent,
        "events": ["content:loaded"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Agent 1 — Profiler (fan-in of the 3 parallel branches)
# ─────────────────────────────────────────────────────────────────────────────

async def profiler_node(state: PersonalizeState) -> Dict[str, Any]:
    sid = UUID(state["student_id"])
    existing = await get_student_profile(sid)

    profile = _heuristic_merge(
        state.get("parent_inputs") or {},
        state.get("teacher_inputs") or {},
        state.get("child_inputs") or {},
        existing,
    )
    profile.student_id = str(sid)

    # Persist — subsequent calls read this directly.
    await update_student_profile(sid, profile)

    orchestrator_logs.add_log(
        "profiler",
        f"profile built: {len(profile.learning_tags)} tags, modality={profile.preferred_modality}",
    )
    return {"profile": profile, "events": ["profile:built"]}


# ─────────────────────────────────────────────────────────────────────────────
# Agent 2 — Personalizer (may run multiple times due to the cycle)
# ─────────────────────────────────────────────────────────────────────────────

async def personalizer_node(state: PersonalizeState) -> Dict[str, Any]:
    retry = state.get("retry_count", 0)

    # On retry, splice the critic's complaints into the feedback hint so the
    # LLM actually responds to them instead of regenerating the same output.
    recent_feedback = list(state.get("recent_feedback") or [])
    if retry > 0 and state.get("critic_report"):
        cr = state["critic_report"]
        synthetic = {
            "rating": 2,
            "tags": [
                "confusing" if cr.get("accuracy_issues") else "",
                "too_hard" if cr.get("missing_concepts") else "",
            ],
            "free_text": cr.get("summary", ""),
        }
        synthetic["tags"] = [t for t in synthetic["tags"] if t]
        recent_feedback = [synthetic] + recent_feedback

    bundle = await personalize_content(
        profile=state["profile"],
        original_text=state["original_text"],
        title=state.get("content_title", "Lesson"),
        subject=state.get("content_subject", "General"),
        grade_level=state.get("content_grade_level", 3),
        recent_feedback=recent_feedback,
    )

    orchestrator_logs.add_log(
        "personalizer",
        f"bundle produced (attempt {retry + 1}): "
        f"child_content={len(bundle['child_content'])} chars, quiz={len(bundle['quiz'])} items",
    )

    return {
        "bundle": bundle,
        "events": [f"personalizer:attempt={retry + 1}"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Agent 3 — Fidelity Critic
# ─────────────────────────────────────────────────────────────────────────────

async def critic_node(state: PersonalizeState) -> Dict[str, Any]:
    report = await review_personalization(
        original_text=state["original_text"],
        personalized_text=state["bundle"]["child_content"],
        quiz=state["bundle"]["quiz"],
    )

    verdict = "approve" if report.get("recommend_approve") else "reject"
    orchestrator_logs.add_log(
        "critic",
        f"fidelity={report.get('fidelity_score', 0):.2f} → {verdict}",
        {"accuracy_issues": len(report.get("accuracy_issues", []))},
    )

    return {
        "critic_report": report,
        "events": [f"critic:{verdict}"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Conditional edge — the cycle decision
# ─────────────────────────────────────────────────────────────────────────────

def route_after_critic(state: PersonalizeState) -> str:
    """
    If critic rejects AND we haven't hit the retry cap → go back to personalizer.
    Otherwise (approved OR out of retries) → hand off to HITL.
    """
    report = state.get("critic_report") or {}
    approved = bool(report.get("recommend_approve", False))
    retries = state.get("retry_count", 0)

    if not approved and retries < MAX_PERSONALIZE_RETRIES:
        return "retry"
    return "enqueue"


async def bump_retry_node(state: PersonalizeState) -> Dict[str, Any]:
    """Tiny node that increments the retry counter before looping back."""
    new_count = state.get("retry_count", 0) + 1
    orchestrator_logs.add_log("critic", f"looping back: retry #{new_count}")
    return {"retry_count": new_count, "events": [f"retry:{new_count}"]}


# ─────────────────────────────────────────────────────────────────────────────
# Terminal — HITL enqueue
# ─────────────────────────────────────────────────────────────────────────────

async def hitl_enqueue_node(state: PersonalizeState) -> Dict[str, Any]:
    bundle = state["bundle"]
    report = state.get("critic_report") or {}
    profile = state["profile"]

    payload = {
        "student_id": state["student_id"],
        "content_id": state["content_id"],
        "content_title": state.get("content_title", "Lesson"),
        "child_content": bundle["child_content"],
        "quiz": bundle["quiz"],
        "parent_summary": bundle["parent_summary"],
        "men_tags": bundle.get("men_tags", []),
        "cultural_anchors": bundle.get("cultural_anchors", []),
        "original_text": state["original_text"],
        "critic_report": report,
        "profile_snapshot": profile.model_dump(mode="json"),
        "retry_count": state.get("retry_count", 0),
    }

    pending = await enqueue_pending_action(
        action_type="personalization",
        teacher_id=state["teacher_id"],
        payload=payload,
        student_id=UUID(state["student_id"]),
        content_id=UUID(state["content_id"]),
    )

    orchestrator_logs.add_log(
        "hitl",
        f"personalization enqueued for teacher review (pending_id={pending['id']})",
    )

    return {
        "pending_action_id": str(pending["id"]),
        "events": ["hitl:enqueued"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Graph assembly
# ─────────────────────────────────────────────────────────────────────────────

def build_personalize_graph():
    g = StateGraph(PersonalizeState)

    # Parallel fan-out — all four run concurrently when START fans out.
    g.add_node("fetch_parent", fetch_parent_node)
    g.add_node("fetch_teacher", fetch_teacher_node)
    g.add_node("fetch_child", fetch_child_node)
    g.add_node("load_content", load_content_node)

    # Agents
    g.add_node("profiler", profiler_node)
    g.add_node("personalizer", personalizer_node)
    g.add_node("critic", critic_node)
    g.add_node("bump_retry", bump_retry_node)
    g.add_node("hitl_enqueue", hitl_enqueue_node)

    # Fan-out: START → 4 parallel branches
    g.set_entry_point("fetch_parent")
    # LangGraph supports multiple entries via add_edge from START; use set_conditional
    # trick: set entry to a dispatcher. Simpler: use add_edge("__start__", each).
    g.add_edge("__start__", "fetch_parent")
    g.add_edge("__start__", "fetch_teacher")
    g.add_edge("__start__", "fetch_child")
    g.add_edge("__start__", "load_content")

    # Fan-in: all four must complete before profiler runs.
    g.add_edge(["fetch_parent", "fetch_teacher", "fetch_child", "load_content"], "profiler")

    # Linear spine
    g.add_edge("profiler", "personalizer")
    g.add_edge("personalizer", "critic")

    # Conditional: cycle back OR exit to HITL
    g.add_conditional_edges(
        "critic",
        route_after_critic,
        {
            "retry": "bump_retry",
            "enqueue": "hitl_enqueue",
        },
    )
    g.add_edge("bump_retry", "personalizer")   # the actual cycle
    g.add_edge("hitl_enqueue", END)

    # MemorySaver gives us checkpointing — state is preserved across resumes.
    return g.compile(checkpointer=MemorySaver())


# Module-level singleton
personalize_app = build_personalize_graph()


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────

async def run_personalize_pipeline(
    student_id: str, content_id: str, teacher_id: str
) -> Dict[str, Any]:
    """
    Runs the three-agent personalize pipeline end-to-end. Returns the final
    state dict with the pending_action_id on success.
    """
    initial: PersonalizeState = {
        "student_id": student_id,
        "content_id": content_id,
        "teacher_id": teacher_id,
        "retry_count": 0,
        "events": [],
    }

    # thread_id keys the MemorySaver checkpoint — per (student, content) pair.
    config = {"configurable": {"thread_id": f"{student_id}:{content_id}"}}

    final = await personalize_app.ainvoke(initial, config=config)
    return {
        "pending_action_id": final.get("pending_action_id"),
        "retry_count": final.get("retry_count", 0),
        "fidelity_score": (final.get("critic_report") or {}).get("fidelity_score"),
        "recommend_approve": (final.get("critic_report") or {}).get("recommend_approve"),
        "events": final.get("events", []),
    }
