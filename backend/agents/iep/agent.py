import os
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from shared.database import get_pool
from shared.models import LearnerModel
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

# Initialize Gemini
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"))

async def get_student_stats(student_id: UUID) -> Dict[str, Any]:
    """
    Fetches the student's profile, recent sessions, and assessments.
    """
    pool = await get_pool()
    
    # Get Profile
    profile_record = await pool.fetchrow(
        "SELECT profile_data FROM learner_profiles WHERE student_id = $1",
        student_id
    )
    profile = json.loads(profile_record["profile_data"]) if profile_record else {}
    
    # Get Recent Sessions (last 7 days)
    last_week = datetime.now() - timedelta(days=7)
    sessions = await pool.fetch(
        "SELECT * FROM sessions WHERE student_id = $1 AND started_at >= $2 ORDER BY started_at DESC",
        student_id, last_week
    )
    
    # Get Recent Assessments (last 7 days)
    assessments = await pool.fetch(
        "SELECT * FROM assessments WHERE student_id = $1 AND taken_at >= $2 ORDER BY taken_at DESC",
        student_id, last_week
    )
    
    # Aggregate Stats
    total_time_on_page = 0
    total_scroll_velocity = 0
    session_count = len(sessions)
    
    for s in sessions:
        summary = s["telemetry_summary"] or {}
        total_time_on_page += summary.get("timeOnPage", 0)
        total_scroll_velocity += summary.get("scrollVelocity", 0)
        
    avg_scroll = total_scroll_velocity / session_count if session_count > 0 else 0
    
    # Mastery and Ability
    ability_estimate = profile.get("ability_estimate", 0.0)
    mastery_by_topic = profile.get("mastery_by_topic", {})
    
    # Risk Level Heuristic (simplistic for Phase 6)
    frustration_levels = [s["telemetry_summary"].get("current_frustration_level", 0) for s in sessions if s["telemetry_summary"]]
    avg_frustration = sum(frustration_levels) / len(frustration_levels) if frustration_levels else 0
    
    risk_level = "low"
    if avg_frustration > 0.6 or ability_estimate < -1.5:
        risk_level = "high"
    elif avg_frustration > 0.3 or ability_estimate < -0.5:
        risk_level = "medium"

    return {
        "profile": profile,
        "session_count": session_count,
        "total_time_minutes": total_time_on_page / 60,
        "avg_scroll_velocity": avg_scroll,
        "assessments": [dict(a) for a in assessments],
        "ability_estimate": ability_estimate,
        "mastery_by_topic": mastery_by_topic,
        "risk_level": risk_level,
        "avg_frustration": avg_frustration
    }

async def generate_iep_report(student_id: UUID, teacher_id: UUID) -> Dict[str, Any]:
    """
    Generates a personalized IEP report using Gemini 1.5 Flash.
    """
    stats = await get_student_stats(student_id)
    
    prompt = f"""
    You are an AI specialized in Individualized Education Programs (IEP). 
    Generate a weekly progress report for a student based on the following data:
    
    Student Profile: {json.dumps(stats['profile'])}
    Recent Activity (Last 7 Days):
    - Sessions completed: {stats['session_count']}
    - Total engagement time: {stats['total_time_minutes']:.1f} minutes
    - Risk Level: {stats['risk_level']} (Based on frustration telemetry and performance)
    - Average frustration level: {stats['avg_frustration']:.2f} (0.0 to 1.0)
    
    Performance:
    - Current Ability Estimate (IRT Theta): {stats['ability_estimate']:.2f}
    - Mastery by Topic: {json.dumps(stats['mastery_by_topic'])}
    
    Tasks:
    1. Highlight key achievements this week.
    2. Identify topics where the student is struggling.
    3. Note any engagement drops or frustration peaks detected via telemetry.
    4. Provide 3 pedagogical recommendations for the teacher to help this student.
    
    Format the report in professional Markdown.
    """
    
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        markdown_content = response.content
    except Exception as e:
        print(f"Gemini IEP Error: {e}")
        markdown_content = "# Error generating IEP Report\n\nCould not reach the AI agent."

    # Prepare data for storage
    report_data = {
        "markdown": markdown_content,
        "stats_summary": {
            "risk_level": stats['risk_level'],
            "ability": stats['ability_estimate'],
            "sessions": stats['session_count']
        }
    }
    
    # Save to DB
    pool = await get_pool()
    week_str = datetime.now().strftime("%Y-W%W")
    
    # Create PDF
    pdf_filename = f"IEP_{student_id}_{week_str}.pdf"
    pdf_path = os.path.join("/tmp", pdf_filename)
    os.makedirs("/tmp", exist_ok=True)
    
    success = generate_pdf_report(markdown_content, pdf_path, str(student_id))
    if not success:
        print(f"Warning: PDF generation failed for student {student_id}")
    
    report_id = await pool.fetchval(
        "INSERT INTO iep_reports (student_id, teacher_id, report_data, pdf_url, week) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        student_id, teacher_id, json.dumps(report_data), pdf_path if success else None, week_str
    )
    
    return {
        "id": report_id,
        "markdown": markdown_content,
        "pdf_path": pdf_path if success else None,
        "stats": stats
    }

def generate_pdf_report(markdown_text: str, output_path: str, student_name: str) -> bool:
    """
    Converts simple markdown/text to a PDF using ReportLab.
    Returns True if successful, False otherwise.
    """
    try:
        doc = SimpleDocTemplate(output_path, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Custom styles for better look
        title_style = styles['Heading1']
        title_style.alignment = 1 # Center
        
        bullet_style = styles['Bullet']
        bullet_style.leftIndent = 20
        
        normal_style = styles['Normal']
        normal_style.leading = 14
        
        content = []
        content.append(Paragraph(f"Individualized Education Program (IEP)", title_style))
        content.append(Paragraph(f"Weekly Progress Report", styles['Heading2']))
        content.append(Spacer(1, 12))
        content.append(Paragraph(f"<b>Student ID:</b> {student_name}", normal_style))
        content.append(Paragraph(f"<b>Date:</b> {datetime.now().strftime('%Y-%m-%d')}", normal_style))
        content.append(Spacer(1, 24))
        
        lines = markdown_text.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                content.append(Spacer(1, 6))
                continue
                
            if line.startswith('# '):
                content.append(Paragraph(line[2:], styles['Heading1']))
            elif line.startswith('## '):
                content.append(Paragraph(line[3:], styles['Heading2']))
            elif line.startswith('### '):
                content.append(Paragraph(line[4:], styles['Heading3']))
            elif line.startswith('- ') or line.startswith('* '):
                # Simple markdown bold/italic replacement
                clean_line = line[2:].replace('**', '<b>').replace('**', '</b>')
                content.append(Paragraph(f"• {clean_line}", bullet_style))
            else:
                # Simple markdown bold/italic replacement
                clean_line = line.replace('**', '<b>').replace('**', '</b>')
                content.append(Paragraph(clean_line, normal_style))
        
        doc.build(content)
        return True
    except Exception as e:
        print(f"PDF Generation Error: {e}")
        return False
