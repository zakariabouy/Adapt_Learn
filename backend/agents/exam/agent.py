import os
import json
import logging
from typing import Optional
from uuid import UUID

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

from shared.database import get_pool
from shared.rag import build_rag_context
from shared.guardrails import (
    run_input_guardrails,
    run_output_guardrails,
    validate_json_output,
    validate_exam_output,
    check_content_safety,
    filter_unsafe_content,
    log_guardrail_event,
)
from shared.models import (
    ExamType, ExamRequest, ExamQuestion, GeneratedExam, QuizOption,
)

logger = logging.getLogger(__name__)

_llm = None


def get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )
    return _llm


async def _fetch_content_text(content_id: UUID) -> Optional[dict]:
    """Fetch the content item's text, subject, and title from DB."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT title, original_text, subject, grade_level FROM content_items WHERE id = $1",
        content_id,
    )
    if not row:
        return None
    return dict(row)


async def _fetch_class_avg_ability(content_id: UUID) -> float:
    """Get average student ability for students who took quizzes on this content."""
    pool = await get_pool()
    avg = await pool.fetchval(
        """
        SELECT AVG(theta_after)
        FROM assessments a
        JOIN sessions s ON a.session_id = s.id
        WHERE s.content_id = $1
        """,
        content_id,
    )
    return float(avg) if avg is not None else 0.0


def _build_exam_prompt(
    content_text: str,
    subject: str,
    exam_type: ExamType,
    num_questions: int,
    grade_level: int,
    class_avg_ability: float,
) -> str:
    """Build the Gemini prompt for exam generation."""

    type_instruction = {
        ExamType.mcq: "ALL questions must be multiple choice (MCQ) with exactly 4 options (A, B, C, D).",
        ExamType.open: "ALL questions must be open-ended (short answer or essay). No options.",
        ExamType.mixed: f"Generate a mix: roughly {num_questions // 2} MCQ questions and {num_questions - num_questions // 2} open-ended questions.",
    }

    return f"""You are an expert primary school exam creator. Generate an exam for grade {grade_level} students (ages {grade_level + 5}-{grade_level + 6}).

SUBJECT: {subject}
GRADE LEVEL: {grade_level} (primary school)
NUMBER OF QUESTIONS: {num_questions}
EXAM TYPE: {exam_type.value}
{type_instruction[exam_type]}

CLASS AVERAGE ABILITY (IRT theta): {class_avg_ability:.2f}
Calibrate question difficulty around this average. Spread difficulties: some easier ({class_avg_ability - 1:.1f}), some at level ({class_avg_ability:.1f}), some harder ({class_avg_ability + 1:.1f}).

COURSE CONTENT (retrieved via semantic search from the knowledge base):
{content_text[:4000]}

IMPORTANT RULES FOR PRIMARY SCHOOL:
- Use simple, clear language appropriate for {grade_level}th graders
- Short sentences, no complex vocabulary
- Questions should be encouraging, not intimidating
- Include fun elements where possible (stories, animals, colors)
- Hints should be helpful and gentle
- Explanations should teach, not just state the answer
- For MCQ: make wrong answers plausible but clearly distinguishable
- For open questions: specify expected answer length ("Write 1-2 sentences")

Return a JSON object with this EXACT structure:
{{
  "title": "Exam title",
  "subject": "{subject}",
  "grade_level": {grade_level},
  "total_points": <sum of all question points>,
  "duration_minutes": <estimated time>,
  "instructions": "Kid-friendly exam instructions (2-3 sentences)",
  "questions": [
    {{
      "question_number": 1,
      "question_type": "mcq" or "open",
      "text": "The question text",
      "options": [{{"id": "A", "label": "..."}}, {{"id": "B", "label": "..."}}, {{"id": "C", "label": "..."}}, {{"id": "D", "label": "..."}}] or null,
      "correct_answer": "A" or "The full correct answer for open questions",
      "hint": "A gentle hint",
      "explanation": "Why this is the correct answer (educational)",
      "difficulty": <float between -3.0 and 3.0>,
      "topic": "specific topic within the subject",
      "points": 1 for mcq, 2 for open
    }}
  ]
}}

Return ONLY valid JSON. No markdown, no backticks, no extra text."""


async def generate_exam(request: ExamRequest) -> GeneratedExam:
    """
    Main entry point: generates a complete exam using Gemini.
    Called by the exam router (Adam builds the route).
    """
    content_id = UUID(request.content_id)

    # 1. Fetch content metadata
    content_data = await _fetch_content_text(content_id)
    if not content_data:
        raise ValueError(f"Content {request.content_id} not found")

    subject = content_data.get("subject") or "General"

    # 2. RAG: retrieve the most relevant chunks for exam generation
    #    Falls back to raw text truncation if no embeddings exist
    rag_query = f"Key concepts and facts for a {subject} exam, grade {request.target_grade_level}"
    rag_context = await build_rag_context(rag_query, content_id, top_k=8, max_context_chars=4000)
    content_text = rag_context if rag_context else content_data["original_text"]

    # 3. Get class average ability for calibration
    class_avg = await _fetch_class_avg_ability(content_id)

    # 4. Build prompt and call Gemini
    prompt = _build_exam_prompt(
        content_text=content_text,
        subject=subject,
        exam_type=request.exam_type,
        num_questions=request.num_questions,
        grade_level=request.target_grade_level,
        class_avg_ability=class_avg,
    )

    # ── Input guardrails ──
    input_check = await run_input_guardrails(content_text, endpoint="exam/generate")

    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        raw = response.content.strip()

        # Structured output validation via guardrails
        json_check = validate_json_output(raw, required_keys=["questions"])
        if not json_check["valid"]:
            logger.error("Exam JSON validation failed: %s", json_check["errors"])
            raise ValueError(f"AI returned invalid exam format: {json_check['errors']}")

        exam_data = json_check["parsed"]

        # Domain-specific exam validation
        exam_validation = validate_exam_output(exam_data)
        if not exam_validation["valid"]:
            logger.warning("Exam validation errors: %s", exam_validation["errors"])
            await log_guardrail_event(
                event_type="output_validation",
                severity="warning",
                action_taken="flagged",
                endpoint="exam/generate",
                details={"errors": exam_validation["errors"], "warnings": exam_validation["warnings"]},
            )
        if exam_validation.get("warnings"):
            logger.info("Exam validation warnings: %s", exam_validation["warnings"])

    except json.JSONDecodeError as e:
        logger.error("Gemini returned invalid JSON for exam: %s", e)
        raise ValueError("AI returned invalid exam format. Please retry.") from e
    except Exception as e:
        logger.error("Gemini exam generation failed: %s", e)
        raise ValueError(f"Exam generation failed: {e}") from e

    # ── Output content safety ──
    output_check = await run_output_guardrails(
        json.dumps(exam_data), source_text=content_text, endpoint="exam/generate"
    )

    # 4. Parse into typed model
    questions = []
    for q in exam_data.get("questions", []):
        options = None
        if q.get("options"):
            options = [QuizOption(id=o["id"], label=o["label"]) for o in q["options"]]

        questions.append(ExamQuestion(
            question_number=q["question_number"],
            question_type=q["question_type"],
            text=q["text"],
            options=options,
            correct_answer=q["correct_answer"],
            hint=q.get("hint"),
            explanation=q.get("explanation", ""),
            difficulty=q.get("difficulty", 0.0),
            topic=q.get("topic", subject),
            points=q.get("points", 1),
        ))

    return GeneratedExam(
        title=exam_data.get("title", f"{subject} Exam - Grade {request.target_grade_level}"),
        subject=subject,
        grade_level=request.target_grade_level,
        total_points=sum(q.points for q in questions),
        duration_minutes=exam_data.get("duration_minutes", len(questions) * 3),
        instructions=exam_data.get("instructions", "Read each question carefully. Take your time and do your best!"),
        questions=questions,
    )
