"""
End-to-end demo pre-warmer.

For one or more (student, content, teacher) triples this script:
  1. Runs the 3-agent personalize pipeline → pending_action row
  2. Auto-approves it → personalization_deliveries row
  3. Generates an exam, IEP report, and orientation report
  4. Pre-warms visual aid SVGs if the student already has adapted chunks

After it completes, the demo never has to wait on Gemini for any pre-known
clicks. Live clicks on un-prewarmed students/content still hit the LLM
through the rotating key pool.

Edit DEMO_TARGETS below to match the entities you'll show on stage.

Usage (from backend/):
    python -m scripts.prewarm_demo
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional, TypedDict
from uuid import UUID

from agents.adaptation.agent import generate_visual_aid, _visual_cache_path
from agents.exam.agent import generate_exam
from agents.iep.agent import generate_iep_report
from agents.orientation.agent import generate_orientation_report
from orchestrator.personalize_graph import run_personalize_pipeline
from shared.database import get_pool
from shared.models import ExamRequest, ExamType


logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s | %(message)s")
log = logging.getLogger("prewarm_demo")


class Target(TypedDict, total=False):
    student_id: str
    content_id: str
    teacher_id: str
    label: str
    do_personalize: bool
    do_exam: bool
    do_iep: bool
    do_orientation: bool
    do_visuals: bool


# ─── EDIT ME ────────────────────────────────────────────────────────────────
# These come from the handoff brief. Add more rows for any other
# students/content the jury might click on.
DEMO_TARGETS: list[Target] = [
    {
        "label": "Lina + The Magic of Plants",
        "student_id": "ec84dfb3-009d-4871-91c3-2818b3d824d7",
        "content_id": "834e19d2-0246-4c70-b4c5-e8792a6fd922",
        "teacher_id": "",  # filled in at runtime — see _resolve_teacher_id
        "do_personalize": True,
        "do_exam": True,
        "do_iep": True,
        "do_orientation": True,
        "do_visuals": True,
    },
]
# ────────────────────────────────────────────────────────────────────────────


async def _resolve_teacher_id(explicit: str) -> Optional[str]:
    if explicit:
        return explicit
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id FROM users WHERE role = 'teacher' ORDER BY created_at LIMIT 1"
    )
    return str(row["id"]) if row else None


async def _approve_pending(pending_id: str) -> None:
    """Mark pending_action approved AND materialize the delivery row.
    Mirrors what routers/pending.py does in approve_pending_action.
    """
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE pending_actions
        SET status = 'approved', approved_at = NOW()
        WHERE id = $1
        RETURNING id, action_type, student_id, teacher_id, content_id, payload
        """,
        UUID(pending_id),
    )
    if not row:
        log.warning("pending %s not found for approval", pending_id)
        return

    payload = row["payload"]
    if isinstance(payload, str):
        payload = json.loads(payload)

    if row["action_type"] == "personalization":
        await pool.execute(
            """
            INSERT INTO personalization_deliveries
                (student_id, content_id, pending_action_id,
                 child_content, quiz, parent_summary,
                 critic_report, approved_by)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8)
            ON CONFLICT DO NOTHING
            """,
            row["student_id"], row["content_id"], row["id"],
            payload.get("child_content", ""),
            json.dumps(payload.get("quiz", [])),
            payload.get("parent_summary", ""),
            json.dumps(payload.get("critic_report") or {}),
            row["teacher_id"],
        )


async def _personalize(t: Target) -> None:
    log.info("[%s] personalize: running pipeline...", t["label"])
    result = await run_personalize_pipeline(
        student_id=t["student_id"],
        content_id=t["content_id"],
        teacher_id=t["teacher_id"],
    )
    pid = result.get("pending_action_id")
    log.info("[%s] personalize: pending=%s fidelity=%s", t["label"], pid, result.get("fidelity_score"))
    if pid:
        await _approve_pending(str(pid))
        log.info("[%s] personalize: delivered", t["label"])


async def _exam(t: Target) -> None:
    log.info("[%s] exam: generating...", t["label"])
    req = ExamRequest(
        content_id=t["content_id"],
        exam_type=ExamType.mcq,
        num_questions=5,
        target_grade_level=3,
    )
    exam = await generate_exam(req)
    log.info("[%s] exam: %d questions generated", t["label"], len(exam.questions))


async def _iep(t: Target) -> None:
    log.info("[%s] iep: generating...", t["label"])
    report = await generate_iep_report(UUID(t["student_id"]), UUID(t["teacher_id"]))
    log.info("[%s] iep: ok keys=%s", t["label"], list(report.keys())[:5])


async def _orientation(t: Target) -> None:
    log.info("[%s] orientation: generating...", t["label"])
    report = await generate_orientation_report(UUID(t["student_id"]))
    log.info("[%s] orientation: ok archetype=%s",
             t["label"], (report.get("archetype") or {}).get("primary"))


async def _visuals(t: Target) -> None:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT adapted_text FROM adapted_content "
        "WHERE content_id = $1 AND student_id = $2 "
        "ORDER BY created_at DESC LIMIT 1",
        UUID(t["content_id"]), UUID(t["student_id"]),
    )
    if not row:
        log.warning(
            "[%s] visuals: no adapted_content row — open the lesson once in the "
            "student workspace, then re-run with do_visuals only.", t["label"],
        )
        return
    chunks = json.loads(row["adapted_text"])
    log.info("[%s] visuals: pre-warming %d chunk(s)", t["label"], len(chunks))
    for i, chunk in enumerate(chunks):
        path = _visual_cache_path(chunk)
        if path.exists():
            log.info("[%s] visuals:   [%d] cached", t["label"], i + 1)
            continue
        svg = await generate_visual_aid(chunk)
        ok = "<svg" in svg and "Illustration coming soon" not in svg
        log.info("[%s] visuals:   [%d] %s", t["label"], i + 1, "OK" if ok else "PLACEHOLDER")


async def _run_target(t: Target) -> None:
    t["teacher_id"] = await _resolve_teacher_id(t.get("teacher_id", ""))
    if not t["teacher_id"]:
        log.error("[%s] no teacher in DB — skipping", t["label"])
        return

    steps = [
        ("personalize", t.get("do_personalize"), _personalize),
        ("exam",        t.get("do_exam"),        _exam),
        ("iep",         t.get("do_iep"),         _iep),
        ("orientation", t.get("do_orientation"), _orientation),
        ("visuals",     t.get("do_visuals"),     _visuals),
    ]
    for name, enabled, fn in steps:
        if not enabled:
            continue
        try:
            await fn(t)
        except Exception as e:
            log.error("[%s] %s FAILED: %s", t["label"], name, e)


async def main() -> int:
    log.info("Starting demo pre-warm for %d target(s)", len(DEMO_TARGETS))
    for t in DEMO_TARGETS:
        await _run_target(t)
    log.info("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
