"""
FastAPI Middleware for Guardrails.

Applied at the request level to enforce:
  - Per-user API rate limiting
  - Input sanitization on POST/PUT request bodies
  - Guardrail audit headers on responses
"""

import json
import time
import logging
from uuid import UUID
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from jose import jwt, JWTError

from shared.guardrails import (
    check_rate_limit,
    detect_prompt_injection,
    sanitize_user_input,
    log_guardrail_event,
)

logger = logging.getLogger(__name__)

# Endpoints exempt from guardrail checks (health, auth, static)
_EXEMPT_PATHS = {"/health", "/auth/login", "/auth/register", "/docs", "/openapi.json", "/redoc"}


def _extract_user_id_from_token(request: Request) -> str | None:
    """Best-effort extraction of user email from Bearer token (no DB call)."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]
    try:
        from shared.security import SECRET_KEY, ALGORITHM
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")  # email as user identifier
    except (JWTError, Exception):
        return None


class GuardrailMiddleware(BaseHTTPMiddleware):
    """
    Request-level guardrail enforcement.
    Runs BEFORE route handlers.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        start = time.time()

        # Skip exempt paths
        if path in _EXEMPT_PATHS or path.startswith("/docs") or path.startswith("/redoc"):
            return await call_next(request)

        user_id = _extract_user_id_from_token(request)

        # ── Rate Limiting ──────────────────────────────────────────────
        if user_id:
            # Classify endpoint group
            if "/upload" in path or "/reembed" in path:
                group = "upload"
            elif any(k in path for k in ["/workspace", "/exam", "/orientation", "/reports", "/game-result"]):
                group = "llm_call"
            else:
                group = "api_general"

            rl = check_rate_limit(user_id, group)
            if not rl["allowed"]:
                logger.warning("Rate limit exceeded for %s on %s (group=%s)", user_id, path, group)
                await log_guardrail_event(
                    event_type="rate_limit",
                    severity="warning",
                    action_taken="blocked",
                    endpoint=path,
                    details={"user": user_id, "group": group, **rl},
                )
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Rate limit exceeded. Please wait before retrying.",
                        "retry_after": rl["retry_after"],
                    },
                    headers={"Retry-After": str(rl["retry_after"])},
                )

        # ── Input Sanitization (POST/PUT with JSON body) ──────────────
        if request.method in ("POST", "PUT") and user_id:
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    body_bytes = await request.body()
                    if body_bytes:
                        body_text = body_bytes.decode("utf-8", errors="replace")
                        injection = detect_prompt_injection(body_text)

                        if injection["is_injection"] and injection["risk_score"] > 0.6:
                            logger.warning(
                                "Prompt injection BLOCKED from %s on %s (score=%.2f)",
                                user_id, path, injection["risk_score"],
                            )
                            await log_guardrail_event(
                                event_type="prompt_injection",
                                severity="critical",
                                action_taken="blocked",
                                endpoint=path,
                                input_snippet=body_text[:500],
                                details=injection,
                            )
                            return JSONResponse(
                                status_code=400,
                                content={"detail": "Request blocked by security guardrails. Input contains disallowed patterns."},
                            )
                except Exception as e:
                    logger.debug("Guardrail body scan skipped: %s", e)

        # ── Process Request ────────────────────────────────────────────
        response = await call_next(request)

        # Add guardrail audit headers
        elapsed = round(time.time() - start, 4)
        response.headers["X-Guardrail-Status"] = "active"
        response.headers["X-Response-Time"] = str(elapsed)

        return response
