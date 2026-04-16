"""
Prompt Builder — Agent 2 (Personalizer)

Loads the versioned system prompt + MEN corpus + golden dataset, and assembles
the final prompt with:
  - MEN competencies / vocabulary / avoid-list (RAG by grade × subject)
  - Constitutional guardrails (static, baked into v3)
  - 2 few-shot examples drawn from the golden dataset (nearest grade × subject)
  - Learner profile, lesson metadata, optional feedback hint

This is the "In-Context Fine-Tuning" integration layer.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from functools import lru_cache
from typing import Dict, Any, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent
CORPUS_PATH = ROOT / "men_corpus" / "competencies.json"
GOLDEN_PATH = ROOT / "golden_dataset.jsonl"
PROMPT_V3 = ROOT / "prompts" / "system_v3.md"

GRADE_LEVEL_TO_NAME = {1: "CE1", 2: "CE1", 3: "CE2", 4: "CM1", 5: "CM2", 6: "6AP"}


@lru_cache(maxsize=1)
def _load_corpus() -> Dict[str, Any]:
    return json.loads(CORPUS_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _load_golden() -> List[Dict[str, Any]]:
    return [
        json.loads(line)
        for line in GOLDEN_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


@lru_cache(maxsize=1)
def _load_prompt_template() -> str:
    raw = PROMPT_V3.read_text(encoding="utf-8")
    # Strip YAML frontmatter
    if raw.startswith("---"):
        parts = raw.split("---", 2)
        if len(parts) >= 3:
            raw = parts[2].lstrip("\n")
    return raw


def _grade_name(grade_level: int) -> str:
    return GRADE_LEVEL_TO_NAME.get(grade_level, "CE2")


def _lookup_men(grade_level: int, subject: str) -> Dict[str, Any]:
    """Return MEN competencies/vocabulary/avoid list for this grade × subject."""
    corpus = _load_corpus()
    grade = _grade_name(grade_level)
    subj_data = corpus["subjects"].get(subject, {})
    grade_data = subj_data.get(grade, {}) if isinstance(subj_data, dict) else {}
    transversal = subj_data.get("transversal", {}) if isinstance(subj_data, dict) else {}
    return {
        "grade": grade,
        "competencies": grade_data.get("competencies") or transversal.get("competencies") or [],
        "vocabulary": grade_data.get("vocabulary", []),
        "avoid": grade_data.get("avoid", []),
        "pedagogical_note": grade_data.get("pedagogical_note")
            or subj_data.get("_note")
            or "",
        "themes_culturels": grade_data.get("themes_culturels", []),
    }


def _select_few_shots(grade_level: int, subject: str, k: int = 2) -> List[Dict[str, Any]]:
    """Pick k nearest examples: same subject+grade first, then same subject, then any."""
    golden = _load_golden()
    target_grade = _grade_name(grade_level)

    same_both = [g for g in golden if g["subject"] == subject and g["grade"] == target_grade]
    same_subject = [g for g in golden if g["subject"] == subject and g["grade"] != target_grade]
    others = [g for g in golden if g["subject"] != subject]

    pool: List[Dict[str, Any]] = []
    pool.extend(same_both)
    pool.extend(same_subject)
    pool.extend(others)
    return pool[:k]


def _format_few_shot(example: Dict[str, Any]) -> str:
    exp = example["expected_output"]
    return (
        f"### Example ({example['grade']} / {example['subject']})\n"
        f"**Input lesson:** {example['original_content']}\n\n"
        f"**Gold output child_content:**\n{exp['child_content']}\n\n"
        f"**Gold parent_summary:** {exp['parent_summary']}\n"
        f"**men_tags:** {exp.get('men_tags', [])}\n"
        f"**cultural_anchors:** {exp.get('cultural_anchors', [])}\n"
    )


def _format_list(items: List[str]) -> str:
    return "\n".join(f"- {x}" for x in items) if items else "- (none)"


def build_v3_prompt(
    *,
    profile_desc: str,
    title: str,
    subject: str,
    grade_level: int,
    safe_text: str,
    target_chars: int,
    feedback_hint: str = "",
) -> str:
    """Assemble the final v3 prompt for Gemini."""
    men = _lookup_men(grade_level, subject)
    few_shots = _select_few_shots(grade_level, subject, k=2)
    few_shot_str = "\n\n".join(_format_few_shot(ex) for ex in few_shots) or "(no examples available)"

    template = _load_prompt_template()
    return (template
        .replace("{grade}", men["grade"])
        .replace("{subject}", subject)
        .replace("{men_competencies}", _format_list(men["competencies"]))
        .replace("{men_vocabulary}", _format_list(men["vocabulary"]))
        .replace("{men_avoid}", _format_list(men["avoid"]))
        .replace("{men_pedagogical_note}",
                 f"\n**Note pédagogique :** {men['pedagogical_note']}" if men["pedagogical_note"] else "")
        .replace("{few_shot_examples}", few_shot_str)
        .replace("{profile_desc}", profile_desc)
        .replace("{title}", title)
        .replace("{grade_level}", str(grade_level))
        .replace("{age_low}", str(grade_level + 5))
        .replace("{age_high}", str(grade_level + 6))
        .replace("{safe_text}", safe_text[:4000])
        .replace("{feedback_hint}", feedback_hint)
        .replace("{target_chars}", str(target_chars))
    )
