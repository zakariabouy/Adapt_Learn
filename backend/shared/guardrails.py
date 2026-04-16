"""
Guardrails Module — Safety layer for the AdaptLearn agentic platform.

Covers all Cahier des Charges requirements:
  1. Prompt Injection Protection  — detect & block injection attempts before LLM
  2. Output Content Safety        — filter harmful/inappropriate content (child audience)
  3. Hallucination Detection       — cross-reference AI output against source material
  4. Structured Output Validation  — enforce JSON schema on Gemini responses
  5. Rate Limiting                 — per-user sliding-window throttle
  6. Audit Logging                 — persistent event trail for every guardrail trigger
  7. Agent Autonomy Control        — restrict scope of autonomous agent actions
"""

import re
import json
import logging
import time
from typing import Optional
from uuid import UUID
from collections import defaultdict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# 1. PROMPT INJECTION DETECTION
# ─────────────────────────────────────────────────────────────────────────────

# Patterns that indicate an attempt to override system instructions
_INJECTION_PATTERNS = [
    # Direct instruction overrides
    r"ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?|context)",
    r"disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)",
    r"forget\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)",
    # System prompt extraction
    r"(show|reveal|display|print|output|repeat)\s+(me\s+)?(your|the|system)\s+(system\s+)?(prompt|instructions?|rules?)",
    r"what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions?|rules?|directives?)",
    # Role hijacking
    r"you\s+are\s+now\s+(a|an|the)\s+",
    r"act\s+as\s+(a|an|the)\s+",
    r"pretend\s+(to\s+be|you\s+are)\s+",
    r"switch\s+to\s+.{0,20}\s+mode",
    # Jailbreak patterns
    r"DAN\s+mode",
    r"developer\s+mode",
    r"do\s+anything\s+now",
    r"jailbreak",
    # Delimiter injection (trying to close/open prompt sections)
    r"```\s*(system|assistant|user)\s*\n",
    r"<\|?(system|im_start|im_end|endoftext)\|?>",
    r"\[INST\]|\[/INST\]|\<\<SYS\>\>",
    # Data exfiltration attempts
    r"(send|transmit|post|fetch|curl|wget)\s+.{0,30}(http|url|api|endpoint)",
    r"execute\s+(command|code|script|shell|bash|python)",
]

_COMPILED_INJECTION_PATTERNS = [re.compile(p, re.IGNORECASE) for p in _INJECTION_PATTERNS]


def detect_prompt_injection(text: str) -> dict:
    """
    Scans user-provided text for prompt injection attempts.
    Returns {"is_injection": bool, "matched_patterns": [...], "risk_score": float}
    """
    if not text:
        return {"is_injection": False, "matched_patterns": [], "risk_score": 0.0}

    matched = []
    for i, pattern in enumerate(_COMPILED_INJECTION_PATTERNS):
        if pattern.search(text):
            matched.append(_INJECTION_PATTERNS[i])

    # Heuristic: excessive special characters or control tokens
    special_ratio = sum(1 for c in text if c in '{}[]<>|\\`~') / max(len(text), 1)
    has_excessive_specials = special_ratio > 0.15

    risk_score = min(1.0, len(matched) * 0.35 + (0.3 if has_excessive_specials else 0.0))

    return {
        "is_injection": len(matched) > 0 or has_excessive_specials,
        "matched_patterns": matched[:5],  # cap for logging
        "risk_score": round(risk_score, 2),
    }


def sanitize_user_input(text: str, max_length: int = 10000) -> str:
    """
    Sanitizes user input before it reaches any LLM prompt.
    - Truncates to max_length
    - Strips control characters
    - Neutralizes known delimiter patterns
    """
    if not text:
        return ""

    # Truncate
    text = text[:max_length]

    # Strip null bytes and non-printable control characters (keep newlines, tabs)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

    # Neutralize prompt delimiter patterns
    text = re.sub(r'<\|?(system|im_start|im_end|endoftext)\|?>', '[filtered]', text, flags=re.IGNORECASE)
    text = re.sub(r'\[INST\]|\[/INST\]', '[filtered]', text, flags=re.IGNORECASE)
    text = re.sub(r'<<SYS>>|<</SYS>>', '[filtered]', text, flags=re.IGNORECASE)

    return text.strip()


# ─────────────────────────────────────────────────────────────────────────────
# 2. OUTPUT CONTENT SAFETY (child-appropriate)
# ─────────────────────────────────────────────────────────────────────────────

# Words/phrases inappropriate for primary school children (grades 1-6)
_UNSAFE_CONTENT_PATTERNS = [
    # Violence
    r"\b(kill(ing|ed|s)?|murder(ed|s|ing)?|blood(y|shed)?|weapon(s)?|gun(s)?|stab(bed|bing)?)\b",
    r"\b(violen(ce|t)|assault(ed)?|attack(ed|ing)?|shoot(ing)?|bomb(s|ing|ed)?)\b",
    # Explicit content
    r"\b(sex(ual|ually)?|nude|naked|porn|erotic|obscene)\b",
    # Profanity (common)
    r"\b(damn|hell|shit|fuck|ass|bitch|bastard|crap)\b",
    # Drugs/alcohol
    r"\b(drug(s)?|cocaine|heroin|marijuana|alcohol|beer|wine|drunk|smoking|cigarette)\b",
    # Self-harm
    r"\b(suicide|self.?harm|cut(ting)?\s+(your|my)self|kill\s+(your|my)self)\b",
    # Discrimination
    r"\b(racist|sexist|homophob|hate\s+speech|discriminat)\b",
    # Fear/horror inappropriate for children
    r"\b(horror|terrif(y|ying|ied)|nightmare|demon(s)?|devil|satan)\b",
]

_COMPILED_UNSAFE_PATTERNS = [re.compile(p, re.IGNORECASE) for p in _UNSAFE_CONTENT_PATTERNS]


def check_content_safety(text: str) -> dict:
    """
    Checks AI-generated content for child-inappropriate material.
    Returns {"is_safe": bool, "violations": [...], "severity": str}
    """
    if not text:
        return {"is_safe": True, "violations": [], "severity": "none"}

    violations = []
    for i, pattern in enumerate(_COMPILED_UNSAFE_PATTERNS):
        matches = pattern.findall(text)
        if matches:
            violations.append({
                "category": _UNSAFE_CONTENT_PATTERNS[i],
                "matches": list(set(m if isinstance(m, str) else m[0] for m in matches))[:5],
            })

    if not violations:
        return {"is_safe": True, "violations": [], "severity": "none"}

    severity = "critical" if len(violations) >= 3 else "warning"
    return {
        "is_safe": False,
        "violations": violations,
        "severity": severity,
    }


def filter_unsafe_content(text: str) -> str:
    """
    Removes or replaces unsafe content from AI output.
    Used as a fallback when content safety check fails.
    """
    for pattern in _COMPILED_UNSAFE_PATTERNS:
        text = pattern.sub("[content filtered]", text)
    return text


# ─────────────────────────────────────────────────────────────────────────────
# 3. HALLUCINATION DETECTION
# ─────────────────────────────────────────────────────────────────────────────

def check_hallucination(ai_output: str, source_text: str, threshold: float = 0.3) -> dict:
    """
    Basic hallucination detection: checks if key claims in AI output
    can be traced back to the source material.

    Uses keyword overlap as a lightweight proxy. For production,
    this would use semantic similarity, but pattern matching is
    fast and sufficient for the educational domain.

    Returns {"has_hallucination_risk": bool, "coverage_score": float, "ungrounded_sentences": [...]}
    """
    if not ai_output or not source_text:
        return {"has_hallucination_risk": False, "coverage_score": 1.0, "ungrounded_sentences": []}

    source_lower = source_text.lower()
    # Extract meaningful words from source (4+ chars to skip stopwords)
    source_words = set(re.findall(r'\b[a-zA-Z]{4,}\b', source_lower))

    sentences = re.split(r'[.!?]+', ai_output)
    ungrounded = []

    for sentence in sentences:
        sentence = sentence.strip()
        if len(sentence) < 15:  # skip very short fragments
            continue

        sentence_words = set(re.findall(r'\b[a-zA-Z]{4,}\b', sentence.lower()))
        if not sentence_words:
            continue

        overlap = len(sentence_words & source_words) / len(sentence_words)
        if overlap < threshold:
            ungrounded.append(sentence[:200])

    total_sentences = max(len([s for s in sentences if len(s.strip()) >= 15]), 1)
    coverage = 1.0 - (len(ungrounded) / total_sentences)

    return {
        "has_hallucination_risk": len(ungrounded) > 0,
        "coverage_score": round(coverage, 2),
        "ungrounded_sentences": ungrounded[:5],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. STRUCTURED OUTPUT VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

def validate_json_output(raw_text: str, required_keys: list[str]) -> dict:
    """
    Validates that LLM output is valid JSON and contains required keys.
    Returns {"valid": bool, "parsed": dict|None, "errors": [...]}
    """
    errors = []

    # Strip markdown fences
    cleaned = raw_text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json")[1].split("```")[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```")[1].split("```")[0].strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        return {
            "valid": False,
            "parsed": None,
            "errors": [f"Invalid JSON: {str(e)[:200]}"],
        }

    if not isinstance(parsed, dict):
        return {
            "valid": False,
            "parsed": None,
            "errors": ["Expected JSON object, got " + type(parsed).__name__],
        }

    missing = [k for k in required_keys if k not in parsed]
    if missing:
        errors.append(f"Missing required keys: {missing}")

    return {
        "valid": len(errors) == 0,
        "parsed": parsed,
        "errors": errors,
    }


def validate_exam_output(exam_data: dict) -> dict:
    """
    Domain-specific validation for generated exams.
    Ensures questions are well-formed and appropriate.
    """
    errors = []
    warnings = []

    questions = exam_data.get("questions", [])
    if not questions:
        errors.append("Exam has no questions")
        return {"valid": False, "errors": errors, "warnings": warnings}

    for i, q in enumerate(questions):
        qnum = q.get("question_number", i + 1)

        # Check required fields
        if not q.get("text"):
            errors.append(f"Q{qnum}: missing question text")
        if not q.get("correct_answer"):
            errors.append(f"Q{qnum}: missing correct answer")

        # MCQ validation
        if q.get("question_type") == "mcq":
            options = q.get("options", [])
            if len(options) < 2:
                errors.append(f"Q{qnum}: MCQ needs at least 2 options, got {len(options)}")
            if len(options) > 6:
                warnings.append(f"Q{qnum}: too many options ({len(options)}), consider 4")

            option_ids = [o.get("id") for o in options]
            if q.get("correct_answer") not in option_ids:
                errors.append(f"Q{qnum}: correct_answer '{q.get('correct_answer')}' not in options {option_ids}")

        # Difficulty range
        diff = q.get("difficulty", 0)
        if diff < -3.0 or diff > 3.0:
            warnings.append(f"Q{qnum}: difficulty {diff} outside IRT range [-3, 3]")

        # Content safety on question text
        safety = check_content_safety(q.get("text", "") + " " + q.get("explanation", ""))
        if not safety["is_safe"]:
            errors.append(f"Q{qnum}: content safety violation in question text")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. RATE LIMITING (in-memory + DB-backed)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RateLimitConfig:
    max_requests: int
    window_seconds: int


# Default rate limits per endpoint group
RATE_LIMITS: dict[str, RateLimitConfig] = {
    "llm_call": RateLimitConfig(max_requests=30, window_seconds=60),
    "upload": RateLimitConfig(max_requests=10, window_seconds=60),
    "api_general": RateLimitConfig(max_requests=120, window_seconds=60),
}


class InMemoryRateLimiter:
    """
    Sliding-window rate limiter using in-memory storage.
    Fast path for request-time checks; DB logging is async/deferred.
    """

    def __init__(self):
        # {(user_id, group): [timestamp, ...]}
        self._windows: dict[tuple, list[float]] = defaultdict(list)

    def check(self, user_id: str, group: str = "api_general") -> dict:
        config = RATE_LIMITS.get(group, RATE_LIMITS["api_general"])
        key = (user_id, group)
        now = time.time()
        cutoff = now - config.window_seconds

        # Prune old entries
        self._windows[key] = [t for t in self._windows[key] if t > cutoff]

        current_count = len(self._windows[key])
        allowed = current_count < config.max_requests

        if allowed:
            self._windows[key].append(now)

        return {
            "allowed": allowed,
            "current_count": current_count + (1 if allowed else 0),
            "limit": config.max_requests,
            "window_seconds": config.window_seconds,
            "retry_after": int(self._windows[key][0] - cutoff) + 1 if not allowed and self._windows[key] else 0,
        }


# Singleton rate limiter
_rate_limiter = InMemoryRateLimiter()


def check_rate_limit(user_id: str, group: str = "api_general") -> dict:
    return _rate_limiter.check(user_id, group)


# ─────────────────────────────────────────────────────────────────────────────
# 6. AUDIT LOGGING
# ─────────────────────────────────────────────────────────────────────────────

async def log_guardrail_event(
    event_type: str,
    severity: str,
    action_taken: str,
    user_id: Optional[UUID] = None,
    endpoint: Optional[str] = None,
    input_snippet: Optional[str] = None,
    output_snippet: Optional[str] = None,
    details: Optional[dict] = None,
):
    """
    Persists a guardrail event to the database for auditing.
    Non-blocking: failures are logged but don't affect the request.
    """
    try:
        from shared.database import get_pool
        pool = await get_pool()
        await pool.execute(
            """INSERT INTO guardrail_events
               (event_type, severity, user_id, endpoint, input_snippet, output_snippet, details, action_taken)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
            event_type,
            severity,
            user_id,
            endpoint,
            (input_snippet[:500] if input_snippet else None),
            (output_snippet[:500] if output_snippet else None),
            json.dumps(details or {}),
            action_taken,
        )
    except Exception as e:
        logger.warning("Failed to log guardrail event: %s", e)


# ─────────────────────────────────────────────────────────────────────────────
# 7. AGENT AUTONOMY CONTROL
# ─────────────────────────────────────────────────────────────────────────────

# Actions that agents can perform autonomously vs. requiring approval
AUTONOMOUS_ACTIONS = {
    "adapt_content",        # simplify text — low risk
    "chunk_content",        # split text — no risk
    "generate_visual",      # SVG generation — low risk
    "summarize_text",       # summarization — low risk
    "quiz_question",        # adaptive quiz — low risk
    "semantic_search",      # RAG retrieval — no risk
    "tts_convert",          # text-to-speech — low risk
    "game_profiler",        # update learning tags — low risk
}

REQUIRES_REVIEW = {
    "generate_exam",        # full exam creation — medium risk
    "orientation_report",   # career guidance — high risk (affects student trajectory)
    "iep_report",           # individualized education plan — high risk
    "modify_grade_level",   # changing student grade — high risk
    "delete_content",       # data deletion — medium risk
}


def check_agent_autonomy(action: str) -> dict:
    """
    Determines whether an agent action can proceed autonomously
    or needs human review (HITL integration point).
    """
    if action in AUTONOMOUS_ACTIONS:
        return {"allowed": True, "requires_review": False, "reason": "Low-risk autonomous action"}

    if action in REQUIRES_REVIEW:
        return {
            "allowed": False,
            "requires_review": True,
            "reason": f"Action '{action}' requires teacher/admin review before execution",
        }

    # Unknown actions are blocked by default (fail-closed)
    return {
        "allowed": False,
        "requires_review": True,
        "reason": f"Unknown action '{action}' — blocked by default (fail-closed policy)",
    }


# ─────────────────────────────────────────────────────────────────────────────
# 8. HIGH-LEVEL GUARDRAIL PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

async def run_input_guardrails(
    text: str,
    user_id: Optional[UUID] = None,
    endpoint: Optional[str] = None,
) -> dict:
    """
    Full input guardrail pipeline. Call before any LLM invocation.
    Returns {"safe": bool, "sanitized_text": str, "issues": [...]}
    """
    issues = []

    # 1. Prompt injection check
    injection = detect_prompt_injection(text)
    if injection["is_injection"]:
        issues.append({
            "type": "prompt_injection",
            "risk_score": injection["risk_score"],
            "patterns": injection["matched_patterns"][:3],
        })
        await log_guardrail_event(
            event_type="prompt_injection",
            severity="critical" if injection["risk_score"] > 0.6 else "warning",
            action_taken="sanitized",
            user_id=user_id,
            endpoint=endpoint,
            input_snippet=text[:500],
            details=injection,
        )

    # 2. Sanitize
    sanitized = sanitize_user_input(text)

    # 3. Rate limit check (if user_id provided)
    if user_id:
        rl = check_rate_limit(str(user_id), "llm_call")
        if not rl["allowed"]:
            issues.append({"type": "rate_limit", "retry_after": rl["retry_after"]})
            await log_guardrail_event(
                event_type="rate_limit",
                severity="warning",
                action_taken="blocked",
                user_id=user_id,
                endpoint=endpoint,
                details=rl,
            )
            return {"safe": False, "sanitized_text": sanitized, "issues": issues}

    safe = not any(i["type"] == "prompt_injection" and i.get("risk_score", 0) > 0.6 for i in issues)

    return {"safe": safe, "sanitized_text": sanitized, "issues": issues}


async def run_output_guardrails(
    output_text: str,
    source_text: Optional[str] = None,
    user_id: Optional[UUID] = None,
    endpoint: Optional[str] = None,
) -> dict:
    """
    Full output guardrail pipeline. Call after every LLM response.
    Returns {"safe": bool, "filtered_text": str, "issues": [...]}
    """
    issues = []

    # 1. Content safety
    safety = check_content_safety(output_text)
    if not safety["is_safe"]:
        issues.append({"type": "content_safety", "severity": safety["severity"], "violations": len(safety["violations"])})
        await log_guardrail_event(
            event_type="content_safety",
            severity=safety["severity"],
            action_taken="filtered",
            user_id=user_id,
            endpoint=endpoint,
            output_snippet=output_text[:500],
            details=safety,
        )
        output_text = filter_unsafe_content(output_text)

    # 2. Hallucination check (if source material provided)
    if source_text:
        hallucination = check_hallucination(output_text, source_text)
        if hallucination["has_hallucination_risk"] and hallucination["coverage_score"] < 0.5:
            issues.append({
                "type": "hallucination",
                "coverage_score": hallucination["coverage_score"],
                "ungrounded_count": len(hallucination["ungrounded_sentences"]),
            })
            await log_guardrail_event(
                event_type="hallucination",
                severity="warning",
                action_taken="flagged",
                user_id=user_id,
                endpoint=endpoint,
                output_snippet=output_text[:500],
                details=hallucination,
            )

    safe = not any(i.get("severity") == "critical" for i in issues)

    return {"safe": safe, "filtered_text": output_text, "issues": issues}
