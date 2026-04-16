"""
Content Critic Agent — Reviews raw uploaded content and provides constructive feedback.

This agent is a new LangGraph node that:
1. Analyzes lesson clarity, structure, and completeness
2. Checks grade-level appropriateness
3. Flags issues (too detailed, too vague, outdated, missing key concepts)
4. Provides actionable improvement suggestions
5. Scores overall quality
"""

import os
import json
import logging
import textstat
from typing import Dict, Any, List
from uuid import UUID

from langchain_core.messages import HumanMessage

from shared.llm import get_rotating_llm
from shared.database import get_pool
from shared.guardrails import run_input_guardrails, validate_json_output

logger = logging.getLogger(__name__)


def get_llm():
    return get_rotating_llm("gemini-1.5-flash")


def _build_critic_prompt(title: str, text: str, subject: str, grade_level: int) -> str:
    """Build the Gemini prompt for content criticism."""
    readability = textstat.flesch_kincaid_grade(text)
    word_count = len(text.split())

    return f"""You are an expert educational content reviewer for primary school material (grades 1-6).

CONTENT TO REVIEW:
Title: {title}
Subject: {subject}
Target Grade Level: {grade_level} (ages {grade_level + 5}-{grade_level + 6})
Word Count: {word_count}
Readability (Flesch-Kincaid Grade): {readability:.1f}

CONTENT TEXT:
{text[:5000]}

Perform a thorough review and return a JSON object with this structure:
{{
  "overall_score": <float 0.0 to 1.0>,
  "grade_appropriateness": <float 0.0 to 1.0>,
  "clarity_score": <float 0.0 to 1.0>,
  "completeness_score": <float 0.0 to 1.0>,
  "engagement_score": <float 0.0 to 1.0>,
  "summary": "2-3 sentence overall assessment",
  "strengths": ["strength 1", "strength 2", ...],
  "issues": [
    {{
      "severity": "high" or "medium" or "low",
      "category": "clarity" or "grade_level" or "completeness" or "accuracy" or "engagement" or "structure",
      "description": "What the issue is",
      "suggestion": "How to fix it"
    }}
  ],
  "suggestions": [
    "Actionable improvement suggestion 1",
    "Actionable improvement suggestion 2"
  ],
  "recommended_changes": "A paragraph describing what the teacher should change before this content is used with students"
}}

REVIEW CRITERIA:
1. **Grade Appropriateness**: Is the vocabulary and sentence complexity right for grade {grade_level}?
   - FK readability {readability:.1f} vs target max {grade_level + 2}
2. **Clarity**: Are concepts explained clearly? Are there ambiguous statements?
3. **Completeness**: Does the lesson cover the topic sufficiently? Are key concepts missing?
4. **Engagement**: Would a {grade_level + 5}-year-old find this interesting? Are there examples, stories, or interactive elements?
5. **Structure**: Is the content well-organized with a logical flow?
6. **Accuracy**: Flag anything that seems factually incorrect or misleading

Be constructive and encouraging — the teacher is trying their best.
Return ONLY valid JSON."""


async def review_content(
    content_id: UUID,
    title: str,
    text: str,
    subject: str,
    grade_level: int,
) -> Dict[str, Any]:
    """
    Main entry point: reviews content and stores the review.
    Returns the structured review.
    """
    # Input guardrails
    input_check = await run_input_guardrails(text, endpoint="content_critic/review")
    text = input_check["sanitized_text"]

    prompt = _build_critic_prompt(title, text, subject or "General", grade_level or 3)

    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        raw = response.content.strip()

        json_check = validate_json_output(raw, required_keys=["overall_score", "issues", "suggestions"])
        if json_check["valid"]:
            review = json_check["parsed"]
        else:
            logger.warning("Content critic JSON invalid: %s", json_check["errors"])
            raise ValueError("Invalid JSON from critic")

    except Exception as e:
        logger.warning("Content critic failed: %s", e)
        # Fallback: basic automated review using textstat
        readability = textstat.flesch_kincaid_grade(text)
        target_max = (grade_level or 3) + 2
        issues = []
        if readability > target_max:
            issues.append({
                "severity": "high",
                "category": "grade_level",
                "description": f"Readability grade {readability:.1f} exceeds target max {target_max}",
                "suggestion": "Simplify vocabulary and shorten sentences",
            })
        if len(text.split()) < 50:
            issues.append({
                "severity": "medium",
                "category": "completeness",
                "description": "Content is very short — may not cover the topic sufficiently",
                "suggestion": "Add more examples and explanations",
            })

        review = {
            "overall_score": 0.5,
            "grade_appropriateness": 1.0 if readability <= target_max else 0.4,
            "clarity_score": 0.5,
            "completeness_score": 0.5,
            "engagement_score": 0.5,
            "summary": "Automated review (AI critic unavailable). Basic checks performed.",
            "strengths": ["Content uploaded successfully"],
            "issues": issues,
            "suggestions": ["Consider running the AI critic again for detailed feedback"],
            "recommended_changes": "",
        }

    # Build markdown feedback
    feedback_md = _build_feedback_markdown(review, title)

    # Store in DB
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO content_reviews (content_id, reviewer_type, overall_score, feedback_markdown, issues, suggestions)
           VALUES ($1, 'ai', $2, $3, $4, $5)""",
        content_id,
        review.get("overall_score", 0.5),
        feedback_md,
        json.dumps(review.get("issues", [])),
        json.dumps(review.get("suggestions", [])),
    )

    return {
        "content_id": str(content_id),
        "review": review,
        "feedback_markdown": feedback_md,
    }


def _build_feedback_markdown(review: Dict, title: str) -> str:
    """Formats the review as readable markdown for the teacher."""
    score = review.get("overall_score", 0)
    grade_emoji = "A" if score >= 0.8 else "B" if score >= 0.6 else "C" if score >= 0.4 else "D"

    lines = [
        f"# Content Review: {title}",
        f"**Overall Score: {score:.0%} ({grade_emoji})**\n",
        review.get("summary", ""),
        "\n## Scores",
        f"- Grade Appropriateness: {review.get('grade_appropriateness', 0):.0%}",
        f"- Clarity: {review.get('clarity_score', 0):.0%}",
        f"- Completeness: {review.get('completeness_score', 0):.0%}",
        f"- Engagement: {review.get('engagement_score', 0):.0%}",
    ]

    strengths = review.get("strengths", [])
    if strengths:
        lines.append("\n## Strengths")
        for s in strengths:
            lines.append(f"- {s}")

    issues = review.get("issues", [])
    if issues:
        lines.append("\n## Issues Found")
        for issue in issues:
            sev = issue.get("severity", "low").upper()
            lines.append(f"- **[{sev}]** {issue.get('description', '')}")
            if issue.get("suggestion"):
                lines.append(f"  - *Suggestion:* {issue['suggestion']}")

    suggestions = review.get("suggestions", [])
    if suggestions:
        lines.append("\n## Improvement Suggestions")
        for s in suggestions:
            lines.append(f"1. {s}")

    rec = review.get("recommended_changes", "")
    if rec:
        lines.append(f"\n## Recommended Changes\n{rec}")

    return "\n".join(lines)


async def get_content_reviews(content_id: UUID) -> List[Dict]:
    """Fetch all reviews for a content item."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM content_reviews WHERE content_id = $1 ORDER BY created_at DESC",
        content_id,
    )
    return [
        {
            "id": str(r["id"]),
            "reviewer_type": r["reviewer_type"],
            "overall_score": r["overall_score"],
            "feedback_markdown": r["feedback_markdown"],
            "issues": r["issues"],
            "suggestions": r["suggestions"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]
