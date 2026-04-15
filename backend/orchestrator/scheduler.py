from apscheduler.schedulers.asyncio import AsyncIOScheduler
from agents.iep.agent import generate_iep_report
from shared.database import get_pool
from shared.pending import enqueue_pending_action
import logging

logger = logging.getLogger(__name__)

async def generate_all_weekly_reports():
    """
    Cron task to generate IEP reports for all linked students.
    Auto-generated reports are routed through HITL — each report lands in
    pending_actions so the teacher can review and approve before anything
    is considered final and parent-visible.
    """
    logger.info("Starting automated weekly IEP report generation...")
    pool = await get_pool()

    links = await pool.fetch("SELECT teacher_id, student_id FROM teacher_student_link")

    count = 0
    for link in links:
        try:
            report = await generate_iep_report(link["student_id"], link["teacher_id"])
            await enqueue_pending_action(
                action_type="iep_report",
                teacher_id=link["teacher_id"],
                payload={
                    "markdown": report.get("markdown"),
                    "pdf_path": report.get("pdf_path"),
                    "auto_generated": True,
                },
                student_id=link["student_id"],
            )
            count += 1
        except Exception as e:
            logger.error(f"Failed to generate automated report for student {link['student_id']}: {e}")

    logger.info(f"Finished. Generated {count} reports (awaiting teacher review).")

def start_scheduler():
    scheduler = AsyncIOScheduler()
    # Schedule for every Sunday at midnight
    scheduler.add_job(generate_all_weekly_reports, 'cron', day_of_week='sun', hour=0, minute=0)
    scheduler.start()
    return scheduler
