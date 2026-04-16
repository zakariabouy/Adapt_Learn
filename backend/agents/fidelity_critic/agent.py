"""
Agent 3 — Fidelity Critic.

Compares the ORIGINAL teacher lesson against the PERSONALIZED version produced
by Agent 2. Flags drift, invented facts, missed concepts, tone problems — and
ultimately recommends whether the bundle is safe to approve.

Distinct from the existing `content_critic` agent, which reviews raw uploaded
content *before* personalization. This one reviews the (original, personalized)
pair *after* personalization, and its report is attached to the pending review
the teacher sees at the HITL gate.
"""

from __future__ import annotations

import os
import re
import json
import logging
from typing import Dict, Any, List

from langchain_core.messages import HumanMessage

from shared.llm import get_rotating_llm
from shared.guardrails import validate_json_output

logger = logging.getLogger(__name__)


def get_llm():
    return get_rotating_llm("gemini-2.5-flash")


# ─────────────────────────────────────────────────────────────────────────────
# Cheap heuristic — used both as fallback AND as a baseline the LLM refines
# ─────────────────────────────────────────────────────────────────────────────

def _heuristic_signals(original: str, personalized: str) -> Dict[str, Any]:
    """Fast rule-based signals used when Gemini is down or as extra evidence."""
    orig_len = max(1, len(original))
    pers_len = max(1, len(personalized))
    length_ratio = pers_len / orig_len

    orig_tokens = set(re.findall(r"[A-Za-z]{4,}", original.lower()))
    pers_tokens = set(re.findall(r"[A-Za-z]{4,}", personalized.lower()))
    overlap = len(orig_tokens & pers_tokens) / max(1, len(orig_tokens))

    warnings = []
    if length_ratio < 0.3:
        warnings.append("Personalized version is much shorter than original — key points may be missing.")
    if length_ratio > 2.5:
        warnings.append("Personalized version is much longer than original — may include invented content.")
    if overlap < 0.2:
        warnings.append("Vocabulary overlap with source is very low — possible hallucination.")

    # Approximate fidelity score from overlap + length-ratio penalty
    length_penalty = min(1.0, abs(1 - length_ratio) / 1.5)
    fidelity = max(0.0, min(1.0, overlap * (1 - 0.5 * length_penalty)))

    return {
        "length_ratio": round(length_ratio, 2),
        "token_overlap": round(overlap, 2),
        "heuristic_fidelity": round(fidelity, 2),
        "heuristic_warnings": warnings,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main entry
# ─────────────────────────────────────────────────────────────────────────────

async def review_personalization(
    original_text: str,
    personalized_text: str,
    quiz: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    """
    Returns a structured critic report:

      {
        "fidelity_score":       0.0–1.0,
        "accuracy_issues":      [ {severity, description, suggestion} ],
        "missing_concepts":     [str],
        "invented_content":     [str],
        "tone_assessment":      str,
        "quiz_alignment":       0.0–1.0,
        "recommend_approve":    bool,
        "summary":              str
      }
    """
    signals = _heuristic_signals(original_text, personalized_text)

    prompt = f"""You audit educational content personalization for PRIMARY SCHOOL children.
Compare the ORIGINAL teacher lesson against the PERSONALIZED version produced
by an AI, and decide whether it is safe to deliver.

## ORIGINAL (authoritative source)
{original_text[:4000]}

## PERSONALIZED (to be audited)
{personalized_text[:4000]}

## QUIZ (to be audited for alignment with the lesson)
{json.dumps(quiz or [], ensure_ascii=False)[:2000]}

## HEURISTIC SIGNALS (already computed — use as evidence, do not recompute)
- length_ratio (personalized/original): {signals['length_ratio']}
- token_overlap: {signals['token_overlap']}
- automated warnings: {signals['heuristic_warnings']}

Return ONLY a JSON object of this exact shape (no markdown, no prose):

{{
  "fidelity_score": <float 0.0-1.0, how faithful personalized is to original>,
  "accuracy_issues": [
    {{
      "severity": "high" | "medium" | "low",
      "description": "what's wrong",
      "suggestion": "how to fix"
    }}
  ],
  "missing_concepts": ["concept present in original but absent from personalized"],
  "invented_content": ["fact/claim in personalized that is NOT in the original"],
  "tone_assessment": "one short sentence on whether tone is age-appropriate and encouraging",
  "quiz_alignment": <float 0.0-1.0, how well quiz tests the personalized lesson>,
  "recommend_approve": <true | false>,
  "summary": "2 sentences for the teacher: overall verdict + top concern"
}}

DECISION RULES:
- recommend_approve = false if ANY accuracy_issue has severity "high"
- recommend_approve = false if invented_content is non-empty with factual claims
- Otherwise recommend_approve = true.
- Be strict on invented facts. Be lenient on style/tone changes."""

    try:
        response = await get_llm().ainvoke([HumanMessage(content=prompt)])
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1].lstrip("json\n").strip()
            if raw.endswith("```"):
                raw = raw.rsplit("```", 1)[0].strip()

        check = validate_json_output(
            raw, required_keys=["fidelity_score", "recommend_approve", "summary"]
        )
        if not check["valid"]:
            logger.warning("Agent 3 JSON invalid (%s) — falling back", check["errors"])
            return _heuristic_report(signals)

        report = check["parsed"]
        # Merge heuristic signals for transparency in the teacher UI
        report["heuristic"] = signals
        return report

    except Exception as e:
        logger.warning("Agent 3 Gemini call failed (%s) — using heuristic report", e)
        return _heuristic_report(signals)


def _heuristic_report(signals: Dict[str, Any]) -> Dict[str, Any]:
    """Minimal report when the LLM is unavailable — never blocks the flow."""
    warnings = signals.get("heuristic_warnings", [])
    fidelity = signals.get("heuristic_fidelity", 0.5)
    return {
        "fidelity_score": fidelity,
        "accuracy_issues": [
            {"severity": "medium", "description": w, "suggestion": "Teacher should verify manually."}
            for w in warnings
        ],
        "missing_concepts": [],
        "invented_content": [],
        "tone_assessment": "Not assessed (AI critic unavailable).",
        "quiz_alignment": 0.5,
        # Approve only if heuristic looks reasonable — teacher still reviews.
        "recommend_approve": fidelity >= 0.5 and not warnings,
        "summary": "Automated heuristic review only — AI critic unavailable. Teacher should verify manually.",
        "heuristic": signals,
    }
