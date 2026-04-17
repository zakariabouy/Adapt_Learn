"""
Agent 2 — Held-Out Evaluation (leave-one-out)
=============================================

Addresses a legitimate concern with the in-repo prompt-eval harness
(`backend/agents/personalizer/eval/evaluate.py`): its `_simulate_v3` function
takes the item's own `expected_output` and hands it to the scorer. That makes
the published 0.86 a **train score** — the metrics never see a v3 output
generated without peeking at the target.

This script closes the loop:

  · For each of the 10 golden items, hide that item from the few-shot pool.
  · Construct the v3 output **mechanically** from the remaining inputs only
    (MEN corpus vocab, Moroccan anchor pool, an LRU few-shot example drawn
    from the 9 OTHER items, learner profile, original content).
  · Score the synthesized output with the same 5 rule-based metrics.
  · Report both per-item and averaged scores, compared to the train score.

No LLM call, no network — fully deterministic. Uses the exact metric
implementations from `evaluate.py` so the numbers are directly comparable.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from agents.personalizer.eval.evaluate import (  # noqa: E402
    load_golden,
    load_corpus,
    metric_men_alignment,
    metric_constitutional,
    metric_cultural_anchoring,
    metric_readability_fit,
    metric_schema_validity,
    MOROCCAN_NAMES,
    CULTURAL_ANCHORS,
    _simulate_v3,  # used once to report the train score for comparison
)

OUT_PATH = Path(__file__).resolve().parent / "agent2_heldout_results.json"


def _synthesize_heldout_v3(
    item: dict,
    corpus: dict,
    few_shot_pool: list[dict],
) -> dict:
    """Synthesize a plausible v3 output for `item` WITHOUT looking at
    `item['expected_output']`. The synthesis mirrors what the production
    prompt produces structurally:

      · injects MEN vocabulary for the target (grade, subject)
      · uses Moroccan names + 2 cultural anchors
      · follows a chunk-size-aware length window
      · follows the canonical JSON schema
      · draws stylistic cues from one few-shot example taken from another
        golden item that matches the same grade or subject (fallback: any)
    """
    subject = item["subject"]
    grade = item["grade"]
    subj_corpus = corpus["subjects"].get(subject, {})
    cell = subj_corpus.get(grade, {}) if isinstance(subj_corpus, dict) else {}
    vocab = cell.get("vocabulary", []) if isinstance(cell, dict) else []

    # Few-shot donor — same grade+subject preferred, else same subject,
    # else any. Never the item itself.
    donors_any = [p for p in few_shot_pool if p["id"] != item["id"]]
    donors_subj = [p for p in donors_any if p["subject"] == subject]
    donors_grade = [p for p in donors_subj if p["grade"] == grade]
    donor = (donors_grade or donors_subj or donors_any)[0]
    donor_expected = donor.get("expected_output", {})
    donor_tone = donor_expected.get("child_content", "")[:120]

    # Deterministic name/anchor pick based on item id hash so the result
    # is reproducible.
    h = sum(ord(c) for c in item["id"])
    name = MOROCCAN_NAMES[h % len(MOROCCAN_NAMES)]
    anchor_a = CULTURAL_ANCHORS[h % len(CULTURAL_ANCHORS)]
    anchor_b = CULTURAL_ANCHORS[(h * 7) % len(CULTURAL_ANCHORS)]

    # Length target tied to the learner profile (same window as metric_readability_fit)
    profile = item["profile"]
    target_chars = max(400, int(profile.get("chunk_size", 200)) * 4)

    vocab_str = ", ".join(vocab[:3]) if vocab else "mots clés de la leçon"
    original_snippet = item["original_content"][: target_chars // 3]

    # Naturalistic assembly — one Moroccan name + at most one cultural anchor.
    # We deliberately do NOT force pluralism keywords or a second anchor;
    # those would inflate the metrics and defeat the honesty of the held-out.
    use_anchor = (h % 3) != 0  # ~two-thirds of outputs mention an anchor
    anchor_clause = f" près de {anchor_a}" if use_anchor else ""
    child_content = (
        f"**{item['title']}**\n\n"
        f"{name} va apprendre{anchor_clause}. "
        f"{original_snippet} "
        f"Mots clés : {vocab_str}. "
        f"({donor_tone[:60]}…)"
    )

    quiz = []
    for i, v in enumerate(vocab[:3] or ["la leçon"] * 3):
        quiz.append({
            "question": f"Dans « {item['title']} », que signifie : {v} ?",
            "options": [v] + [x for x in vocab if x != v][:3] or [v, "A", "B", "C"],
            "correct_index": 0,
            "explanation": f"« {v} » fait partie du vocabulaire MEN de la leçon.",
        })
    while len(quiz) < 3:
        quiz.append({
            "question": f"Que retiens-tu de « {item['title']} » ?",
            "options": ["La leçon principale", "Autre", "Rien", "Tout"],
            "correct_index": 0,
            "explanation": "Tu as bien compris l'idée principale.",
        })

    parent_summary = (
        f"Votre enfant {name} découvre {item['title']} — une compétence du "
        f"programme {grade} en {subject}. Révisez ensemble avec un exemple "
        f"familier ({anchor_a})."
    )

    return {
        "child_content": child_content,
        "quiz": quiz[:5],
        "parent_summary": parent_summary,
    }


def _score(output: dict, item: dict, corpus: dict) -> dict:
    return {
        "men": round(metric_men_alignment(output, item, corpus), 3),
        "const": round(metric_constitutional(output), 3),
        "cult": round(metric_cultural_anchoring(output), 3),
        "read": round(metric_readability_fit(output, item), 3),
        "schema": round(metric_schema_validity(output), 3),
    }


def _overall(scores: dict) -> float:
    return round(sum(scores.values()) / len(scores), 3)


def main():
    golden = load_golden()
    corpus = load_corpus()

    heldout_rows = []
    train_rows = []
    for item in golden:
        # Leave-one-out few-shot pool
        heldout_output = _synthesize_heldout_v3(
            item, corpus, few_shot_pool=golden)  # donor ≠ item by construction
        heldout_scores = _score(heldout_output, item, corpus)

        # Train-style (in-repo harness behavior: v3 output = expected_output)
        train_output = _simulate_v3(item, corpus)
        train_scores = _score(train_output, item, corpus)

        heldout_rows.append({
            "id": item["id"], "grade": item["grade"], "subject": item["subject"],
            **heldout_scores, "overall": _overall(heldout_scores),
        })
        train_rows.append({
            "id": item["id"], "grade": item["grade"], "subject": item["subject"],
            **train_scores, "overall": _overall(train_scores),
        })

    def _avg(rows: list[dict]) -> dict:
        keys = ["men", "const", "cult", "read", "schema", "overall"]
        return {k: round(sum(r[k] for r in rows) / len(rows), 3) for k in keys}

    report = {
        "method": "leave-one-out held-out evaluation of Agent-2 v3 prompt",
        "n_items": len(golden),
        "train_mean": _avg(train_rows),
        "heldout_mean": _avg(heldout_rows),
        "train_per_item": train_rows,
        "heldout_per_item": heldout_rows,
    }
    OUT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False))

    print("=== Agent 2 — Held-Out Evaluation ===\n")
    print(f"{'slice':<10s} {'MEN':>6s} {'Const':>6s} {'Cult':>6s} "
          f"{'Read':>6s} {'Schema':>8s} {'Overall':>8s}")
    for name, row in (("train", report["train_mean"]),
                      ("heldout", report["heldout_mean"])):
        print(f"{name:<10s} {row['men']:>6.2f} {row['const']:>6.2f} "
              f"{row['cult']:>6.2f} {row['read']:>6.2f} "
              f"{row['schema']:>8.2f} {row['overall']:>8.2f}")
    delta = round(report["train_mean"]["overall"]
                  - report["heldout_mean"]["overall"], 3)
    print(f"\nΔ overall (train - heldout) = {delta}")
    print(f"\nResults written to {OUT_PATH}")


if __name__ == "__main__":
    main()
