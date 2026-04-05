import os
import re
import json
import logging
import tempfile
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID

logger = logging.getLogger(__name__)
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from shared.database import get_pool
from shared.models import LearnerModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

_llm = None

def get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.getenv("GOOGLE_API_KEY"))
    return _llm

async def get_student_stats(student_id: UUID) -> Dict[str, Any]:
    """Fetches the student's profile, recent sessions, and assessments."""
    pool = await get_pool()

    # Get user name
    user_row = await pool.fetchrow("SELECT name, email FROM users WHERE id = $1", student_id)
    student_name = (user_row["name"] if user_row and user_row["name"] else
                    user_row["email"].split("@")[0].capitalize() if user_row else "Unknown")

    # Get Profile
    profile_record = await pool.fetchrow(
        "SELECT profile_data FROM learner_profiles WHERE student_id = $1", student_id
    )
    profile = json.loads(profile_record["profile_data"]) if profile_record else {}

    # Get Recent Sessions (last 7 days)
    last_week = datetime.now() - timedelta(days=7)
    sessions = await pool.fetch(
        "SELECT * FROM sessions WHERE student_id = $1 AND started_at >= $2 ORDER BY started_at DESC",
        student_id, last_week
    )

    session_count = len(sessions)
    total_time_on_page = 0
    total_frustration = 0.0

    for s in sessions:
        summary = s["telemetry_summary"] or {}
        if isinstance(summary, str):
            summary = json.loads(summary)
        total_time_on_page += summary.get("timeOnPage", 0)
        total_frustration += summary.get("current_frustration_level", 0.0)

    avg_frustration = total_frustration / session_count if session_count > 0 else 0.0
    total_time_minutes = total_time_on_page / 60.0

    # Ability and mastery from profile
    ability_estimate = profile.get("ability_estimate", 0.0)
    mastery_by_topic = profile.get("mastery_by_topic", {})

    # Risk level
    risk_level = "low"
    if ability_estimate < -1.5 or avg_frustration > 0.7:
        risk_level = "high"
    elif ability_estimate < -0.5 or avg_frustration > 0.4:
        risk_level = "medium"

    return {
        "student_name": student_name,
        "profile": profile,
        "session_count": session_count,
        "total_time_minutes": total_time_minutes,
        "avg_frustration": avg_frustration,
        "risk_level": risk_level,
        "ability_estimate": ability_estimate,
        "mastery_by_topic": mastery_by_topic,
    }

async def generate_iep_report(student_id: UUID, teacher_id: UUID) -> Dict[str, Any]:
    """
    Generates a personalized IEP report using Gemini 1.5 Flash.
    """
    stats = await get_student_stats(student_id)
    
    prompt = f"""
    You are an AI specialized in Individualized Education Programs (IEP). 
    Generate a weekly progress report for a student based on the following data:
    
    Student Name: {stats['student_name']}
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
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        markdown_content = response.content
    except Exception as e:
        logger.error("Gemini IEP generation failed for student %s: %s", student_id, e)
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
    pdf_dir = Path(tempfile.gettempdir()) / "adaptlearn_iep"
    pdf_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = str(pdf_dir / pdf_filename)
    
    success = generate_pdf_report(markdown_content, pdf_path, stats)
    if not success:
        logger.warning("PDF generation failed for student %s", student_id)
    
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

def _md_to_html(text: str) -> str:
    """Converts inline markdown bold/italic to ReportLab HTML tags."""
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    return text

def create_mastery_chart(mastery_data: Dict[str, float]) -> Drawing:
    """Creates a bar chart for mastery by topic."""
    d = Drawing(400, 200)
    if not mastery_data:
        return d
        
    chart = VerticalBarChart()
    chart.x = 50
    chart.y = 50
    chart.height = 125
    chart.width = 300
    chart.data = [list(mastery_data.values())]
    chart.categoryAxis.categoryNames = list(mastery_data.keys())
    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = 100
    chart.valueAxis.valueStep = 20
    chart.bars[0].fillColor = colors.HexColor("#c4c0ff")
    
    d.add(chart)
    return d

def generate_pdf_report(markdown_text: str, output_path: str, stats: Dict[str, Any]) -> bool:
    """
    Converts simple markdown/text to a PDF using ReportLab with tables and charts.
    """
    try:
        doc = SimpleDocTemplate(output_path, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Branding colors
        primary_color = colors.HexColor("#c4c0ff")
        secondary_color = colors.HexColor("#01c896")
        
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.black,
            alignment=1,
            spaceAfter=20
        )
        
        section_style = ParagraphStyle(
            'SectionHeader',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.black,
            spaceBefore=15,
            spaceAfter=10,
            borderPadding=5,
            borderWidth=0,
            leftIndent=0
        )
        
        normal_style = styles['Normal']
        normal_style.fontSize = 10
        normal_style.leading = 14
        
        content = []
        
        # Header
        content.append(Paragraph("ADAPTLEARN", title_style))
        content.append(Paragraph("Individualized Education Program (IEP) Report", styles['Heading2']))
        content.append(Spacer(1, 12))
        
        # Student Info Table
        info_data = [
            ["Student Name:", stats['student_name'], "Report Date:", datetime.now().strftime('%Y-%m-%d')],
            ["Student ID:", str(stats['profile'].get('student_id', 'N/A'))[:8], "Academic Week:", datetime.now().strftime("%Y-W%W")]
        ]
        t = Table(info_data, colWidths=[100, 150, 100, 100])
        t.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 10),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('TEXTCOLOR', (0,0), (0,-1), colors.grey),
            ('TEXTCOLOR', (2,0), (2,-1), colors.grey),
        ]))
        content.append(t)
        content.append(Spacer(1, 24))
        
        # Executive Summary Table
        content.append(Paragraph("Weekly Executive Summary", section_style))
        summary_data = [
            ["Metric", "Value", "Status"],
            ["Risk Level", stats['risk_level'].upper(), "Attention Needed" if stats['risk_level'] != 'low' else "On Track"],
            ["Ability Estimate", f"{stats['ability_estimate']:.2f} θ", "Growing" if stats['ability_estimate'] > 0 else "Needs Support"],
            ["Engaged Time", f"{stats['total_time_minutes']:.1f}m", "Active"],
            ["Sessions", str(stats['session_count']), "Completed"]
        ]
        st = Table(summary_data, colWidths=[150, 100, 150])
        st.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), primary_color),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0,0), (-1,0), 12),
            ('BACKGROUND', (0,1), (-1,-1), colors.whitesmoke),
            ('GRID', (0,0), (-1,-1), 1, colors.grey)
        ]))
        content.append(st)
        content.append(Spacer(1, 24))
        
        # Mastery Chart
        content.append(Paragraph("Subject Mastery Analysis", section_style))
        if stats['mastery_by_topic']:
            content.append(create_mastery_chart(stats['mastery_by_topic']))
        else:
            content.append(Paragraph("<i>No mastery data available for this week.</i>", normal_style))
        content.append(Spacer(1, 24))
        
        # AI Insights Section
        content.append(Paragraph("AI-Generated Pedagogical Insights", section_style))
        
        lines = markdown_text.split('\n')
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'): continue # Skip main title as we added our own
                
            if line.startswith('## '):
                content.append(Paragraph(line[3:], styles['Heading3']))
            elif line.startswith('### '):
                content.append(Paragraph(line[4:], styles['Heading4']))
            elif line.startswith('- ') or line.startswith('* '):
                clean_line = _md_to_html(line[2:])
                content.append(Paragraph(f"• {clean_line}", styles['Bullet']))
            else:
                clean_line = _md_to_html(line)
                content.append(Paragraph(clean_line, normal_style))
        
        # Footer
        def add_footer(canvas, doc):
            canvas.saveState()
            canvas.setFont('Helvetica', 8)
            canvas.drawRightString(letter[0] - 50, 30, f"Page {doc.page} | AdaptLearn Proprietary AI Report")
            canvas.restoreState()
            
        doc.build(content, onLaterPages=add_footer, onFirstPage=add_footer)
        return True
    except Exception as e:
        logger.exception("PDF generation error: %s", e)
        return False
