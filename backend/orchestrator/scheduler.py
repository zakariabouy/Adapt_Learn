from apscheduler.schedulers.asyncio import AsyncIOScheduler
from agents.iep.agent import generate_iep_report
from shared.database import get_pool
import logging

logger = logging.getLogger(__name__)

async def generate_all_weekly_reports():
    """
    Cron task to generate IEP reports for all linked students.
    """
    logger.info("Starting automated weekly IEP report generation...")
    pool = await get_pool()
    
    links = await pool.fetch("SELECT teacher_id, student_id FROM teacher_student_link")
    
    count = 0
    for link in links:
        try:
            await generate_iep_report(link["student_id"], link["teacher_id"])
            count += 1
        except Exception as e:
            logger.error(f"Failed to generate automated report for student {link['student_id']}: {e}")
            
    logger.info(f"Finished. Generated {count} reports.")

def start_scheduler():
    scheduler = AsyncIOScheduler()
    # Schedule for every Sunday at midnight
    scheduler.add_job(generate_all_weekly_reports, 'cron', day_of_week='sun', hour=0, minute=0)
    scheduler.start()
    return scheduler
