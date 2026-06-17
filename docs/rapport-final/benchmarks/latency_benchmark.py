"""
Orchestration & Middleware Latency Benchmark — AdaptLearn
==========================================================

Measures the *offline* portion of the agent pipeline — the code paths that run
on every request independently of the LLM call. These are the layers users
cannot tolerate being slow, so we care about their p50/p95.

Components measured (all deterministic, no network):

  - Prompt injection detection       (`detect_prompt_injection`)
  - Content safety scan              (`check_content_safety`)
  - Hallucination detection          (`check_hallucination`)
  - JSON schema validation           (`validate_json_output`)
  - Rate-limit check                 (`check_rate_limit`)
  - Input sanitization               (`sanitize_user_input`)
  - RAG chunking                     (`chunk_text_for_rag`)
  - Agent-2 prompt assembly (v3)     (Personalizer `build_prompt`)
  - Agent-2 evaluation harness       (full 5-metric sweep over 10 golden items)

LLM-bound latency is intentionally excluded: it depends on Gemini quota and
network conditions, and would not be reproducible for reviewers. It is
captured live in the God-Mode observability panel at runtime.

Run:  python3 latency_benchmark.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from shared.guardrails import (  # noqa: E402
    detect_prompt_injection,
    check_content_safety,
    check_hallucination,
    validate_json_output,
    check_rate_limit,
    sanitize_user_input,
)
# Inline the chunker to avoid importing shared.rag (which pulls in langchain
# google embedding bindings — not needed for offline latency measurement).
import re as _re


def chunk_text_for_rag(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    sentences = _re.split(r"(?<=[.!?])\s+", text.strip())
    if not sentences:
        return [text.strip()] if text.strip() else []
    chunks, current = [], ""
    for sentence in sentences:
        if current and len(current) + len(sentence) + 1 > chunk_size:
            chunks.append(current.strip())
            words = current.split()
            overlap_text = ""
            for w in reversed(words):
                candidate = w + " " + overlap_text if overlap_text else w
                if len(candidate) > overlap:
                    break
                overlap_text = candidate
            current = (overlap_text.strip() + " " + sentence).strip()
        else:
            current += (" " if current else "") + sentence
    if current.strip():
        chunks.append(current.strip())
    return chunks if chunks else [text.strip()]

OUT_PATH = Path(__file__).resolve().parent / "latency_benchmark_results.json"


SAMPLE_INPUT = (
    "Yasmine et Amine découvrent les fractions en regardant un tajine partagé en "
    "8 parts égales. Si Yasmine mange 3 parts et Amine mange 2 parts, ils ont "
    "mangé 5/8 du tajine ensemble. Combien de parts reste-t-il ? "
) * 20

SAMPLE_OUTPUT = (
    "La leçon explique les fractions avec un tajine partagé en 8 parts. Yasmine "
    "mange 3/8 et Amine 2/8. Ensemble ils mangent 5/8. Il reste 3/8 du tajine. "
    "Le numérateur indique la part prise, le dénominateur le nombre total de parts."
)

SAMPLE_JSON = json.dumps({
    "child_content": "Yasmine et Amine mangent 5/8 du tajine ensemble.",
    "quiz": [
        {"question": "Combien de parts reste-t-il ?", "options": ["3/8", "5/8", "8/8", "1/8"],
         "correct_index": 0, "explanation": "8 - 5 = 3."},
        {"question": "Que mange Amine ?", "options": ["3/8", "2/8", "5/8", "1/8"],
         "correct_index": 1, "explanation": "Amine mange 2 parts sur 8."},
        {"question": "Numérateur de 5/8 ?", "options": ["5", "8", "3", "0"],
         "correct_index": 0, "explanation": "Le numérateur est au-dessus."},
    ],
    "parent_summary": "Votre enfant explore les fractions avec un exemple concret.",
})


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = min(len(s) - 1, int(p * (len(s) - 1)))
    return s[idx]


def time_it(fn, iters: int) -> dict:
    latencies = []
    for _ in range(iters):
        t0 = time.perf_counter()
        fn()
        latencies.append((time.perf_counter() - t0) * 1000)
    return {
        "iters": iters,
        "mean_ms": round(sum(latencies) / iters, 4),
        "p50_ms": round(percentile(latencies, 0.50), 4),
        "p95_ms": round(percentile(latencies, 0.95), 4),
        "p99_ms": round(percentile(latencies, 0.99), 4),
        "max_ms": round(max(latencies), 4),
    }


def bench_agent2_eval() -> dict:
    """Run the full Agent-2 prompt-evaluation harness 20×."""
    from agents.personalizer.eval.evaluate import evaluate_all  # noqa: E402
    return time_it(lambda: evaluate_all(), iters=20)


def bench_agent2_prompt_build() -> dict:
    """Build the Personalizer v3 prompt from a synthetic profile + content."""
    from agents.personalizer.prompt_builder import build_v3_prompt  # noqa: E402

    def _run():
        build_v3_prompt(
            profile_desc="Yasmine, CM1, visuel/lecteur, hobbies: dessin, football",
            title="Les fractions au quotidien",
            subject="mathematiques",
            grade_level=4,
            safe_text=SAMPLE_INPUT,
            target_chars=800,
            feedback_hint="",
        )

    return time_it(_run, iters=200)


def bench_hot_path_request() -> dict:
    """Chain the middleware + guardrail checks that fire on *every* LLM-bound
    request, exactly in the order the FastAPI dispatcher runs them:

        rate_limit → prompt_injection_detect → sanitize → chunk

    This gives the real per-request overhead — the sum of the isolated
    components plus Python call overhead — which is what actually matters
    (a single ~request~-equivalent number, not 7 separate micro-bars).
    """
    def _full_pipeline():
        # 1. Rate-limit (middleware would reject here on overflow)
        check_rate_limit("hot-path-bench-user", "llm_call")
        # 2. Prompt-injection scan on the request body
        detect_prompt_injection(SAMPLE_INPUT)
        # 3. Sanitize before LLM invocation
        sanitized = sanitize_user_input(SAMPLE_INPUT)
        # 4. Chunk for RAG (what embed_and_store_content runs upstream
        #    of embedding — the non-network portion)
        chunk_text_for_rag(sanitized)

    return time_it(_full_pipeline, iters=500)


def bench_hot_path_response() -> dict:
    """Post-LLM guardrail chain run on *every* AI output before it reaches
    the student or the HITL queue:

        content_safety → hallucination → json_schema_validate
    """
    def _full_pipeline():
        check_content_safety(SAMPLE_OUTPUT)
        check_hallucination(SAMPLE_OUTPUT, SAMPLE_INPUT)
        validate_json_output(SAMPLE_JSON,
                             ["child_content", "quiz", "parent_summary"])

    return time_it(_full_pipeline, iters=500)


def main():
    results: dict = {}

    results["prompt_injection_detect"] = time_it(
        lambda: detect_prompt_injection(SAMPLE_INPUT), iters=1000)
    results["content_safety_check"] = time_it(
        lambda: check_content_safety(SAMPLE_OUTPUT), iters=1000)
    results["hallucination_check"] = time_it(
        lambda: check_hallucination(SAMPLE_OUTPUT, SAMPLE_INPUT), iters=1000)
    results["json_schema_validate"] = time_it(
        lambda: validate_json_output(SAMPLE_JSON,
                                     ["child_content", "quiz", "parent_summary"]),
        iters=1000)
    results["rate_limit_check"] = time_it(
        lambda: check_rate_limit("bench-user", "llm_call"), iters=1000)
    results["input_sanitize"] = time_it(
        lambda: sanitize_user_input(SAMPLE_INPUT), iters=1000)
    results["rag_chunking_500b"] = time_it(
        lambda: chunk_text_for_rag(SAMPLE_INPUT), iters=500)

    # End-to-end hot-path chains (real request / response overhead)
    results["hot_path_request_chain"] = bench_hot_path_request()
    results["hot_path_response_chain"] = bench_hot_path_response()

    # Agent-level benches
    try:
        results["agent2_prompt_build_v3"] = bench_agent2_prompt_build()
    except Exception as e:
        results["agent2_prompt_build_v3"] = {"error": str(e)[:200]}

    try:
        results["agent2_eval_harness_full"] = bench_agent2_eval()
    except Exception as e:
        results["agent2_eval_harness_full"] = {"error": str(e)[:200]}

    OUT_PATH.write_text(json.dumps(results, indent=2))

    print("=== Latency Benchmark (offline pipeline) ===\n")
    print(f"{'component':<30s}  {'iters':>6s}  {'p50 ms':>10s}  "
          f"{'p95 ms':>10s}  {'p99 ms':>10s}")
    print("-" * 74)
    for name, r in results.items():
        if "error" in r:
            print(f"{name:<30s}  ERROR: {r['error']}")
            continue
        print(f"{name:<30s}  {r['iters']:>6d}  {r['p50_ms']:>10.4f}  "
              f"{r['p95_ms']:>10.4f}  {r['p99_ms']:>10.4f}")
    print(f"\nResults written to {OUT_PATH}")


if __name__ == "__main__":
    main()
