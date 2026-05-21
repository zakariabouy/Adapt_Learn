"""
Multi-provider rotating LLM wrapper.

Primary provider chosen via LLM_PROVIDER env (deepseek|groq|gemini).
On quota/rate-limit errors the wrapper transparently falls back to the
remaining providers so demos stay alive. Inside Gemini we also rotate across
GOOGLE_API_KEY, GOOGLE_API_KEY_2, GOOGLE_API_KEY_3, …

Env vars read:
  LLM_PROVIDER         → "deepseek" | "groq" | "gemini"
                         (default: first of deepseek/groq/gemini whose key is set)
  DEEPSEEK_API_KEY     → DeepSeek key (sk-...)
  DEEPSEEK_MODEL       → default "deepseek-chat"
  DEEPSEEK_BASE_URL    → default "https://api.deepseek.com"
  GROQ_API_KEY         → Groq cloud key (gsk_...)
  GROQ_MODEL           → default "llama-3.3-70b-versatile"
  GOOGLE_API_KEY*      → one or more Gemini keys (round-robin)
"""

from __future__ import annotations

import os
import time
import asyncio
import logging
from typing import Any, List, Optional

from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)

_COOLDOWN_SECONDS = 60


def _load_gemini_keys() -> List[str]:
    keys: List[str] = []
    primary = os.getenv("GOOGLE_API_KEY")
    if primary:
        keys.append(primary)
    i = 2
    while True:
        k = os.getenv(f"GOOGLE_API_KEY_{i}")
        if not k:
            break
        keys.append(k)
        i += 1
    return keys


def _is_quota_error(err: Exception) -> bool:
    msg = str(err).lower()
    return any(
        s in msg
        for s in (
            "429",
            "quota",
            "resource_exhausted",
            "resourceexhausted",
            "rate limit",
            "rate_limit",
            "too many requests",
        )
    )


# ─── Gemini rotator (unchanged behaviour) ─────────────────────────────────────

class _GeminiRotator:
    def __init__(self, model: str, structured_schema: Any, **kwargs: Any):
        self._model = model
        self._kwargs = kwargs
        self._schema = structured_schema
        self._keys = _load_gemini_keys()
        self._idx = 0
        self._cooldown_until = [0.0] * len(self._keys)

    def available(self) -> bool:
        return bool(self._keys)

    def _build(self, key: str):
        llm = ChatGoogleGenerativeAI(model=self._model, google_api_key=key, **self._kwargs)
        if self._schema is not None:
            llm = llm.with_structured_output(self._schema)
        return llm

    def _pick(self) -> Optional[int]:
        now = time.time()
        n = len(self._keys)
        for offset in range(n):
            i = (self._idx + offset) % n
            if self._cooldown_until[i] <= now:
                return i
        return None

    def _cooldown(self, i: int) -> None:
        self._cooldown_until[i] = time.time() + _COOLDOWN_SECONDS
        logger.warning("Gemini key #%d cooldown %ds", i + 1, _COOLDOWN_SECONDS)

    async def ainvoke(self, messages: Any, **kw: Any) -> Any:
        if not self._keys:
            raise RuntimeError("No GOOGLE_API_KEY* configured")
        n = len(self._keys)
        last: Optional[Exception] = None
        for _ in range(n):
            i = self._pick()
            if i is None:
                await asyncio.sleep(0.5)
                i = 0
            self._idx = (i + 1) % n
            try:
                return await self._build(self._keys[i]).ainvoke(messages, **kw)
            except Exception as e:
                last = e
                if _is_quota_error(e):
                    self._cooldown(i)
                    continue
                raise
        assert last is not None
        raise last


# ─── Groq wrapper ─────────────────────────────────────────────────────────────

class _GroqClient:
    def __init__(self, model: str, structured_schema: Any, **kwargs: Any):
        self._key = os.getenv("GROQ_API_KEY")
        self._model = os.getenv("GROQ_MODEL", model)
        self._kwargs = kwargs
        self._schema = structured_schema
        self._cooldown_until = 0.0

    def available(self) -> bool:
        return bool(self._key) and time.time() >= self._cooldown_until

    def _build(self):
        from langchain_groq import ChatGroq
        llm = ChatGroq(model=self._model, api_key=self._key, **self._kwargs)
        if self._schema is not None:
            llm = llm.with_structured_output(self._schema)
        return llm

    async def ainvoke(self, messages: Any, **kw: Any) -> Any:
        if not self._key:
            raise RuntimeError("GROQ_API_KEY not set")
        try:
            return await self._build().ainvoke(messages, **kw)
        except Exception as e:
            if _is_quota_error(e):
                self._cooldown_until = time.time() + _COOLDOWN_SECONDS
                logger.warning("Groq rate limit — cooldown %ds", _COOLDOWN_SECONDS)
            raise


# ─── DeepSeek wrapper (OpenAI-compatible API) ─────────────────────────────────

class _DeepSeekClient:
    def __init__(self, model: str, structured_schema: Any, **kwargs: Any):
        self._key = os.getenv("DEEPSEEK_API_KEY")
        self._model = os.getenv("DEEPSEEK_MODEL", model)
        self._base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        self._kwargs = kwargs
        self._schema = structured_schema
        self._cooldown_until = 0.0

    def available(self) -> bool:
        return bool(self._key) and time.time() >= self._cooldown_until

    def _build(self):
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            model=self._model,
            api_key=self._key,
            base_url=self._base_url,
            **self._kwargs,
        )
        if self._schema is not None:
            # DeepSeek supports tool/function calling but not OpenAI's strict
            # json_schema response_format — pin the method explicitly.
            llm = llm.with_structured_output(self._schema, method="function_calling")
        return llm

    async def ainvoke(self, messages: Any, **kw: Any) -> Any:
        if not self._key:
            raise RuntimeError("DEEPSEEK_API_KEY not set")
        try:
            return await self._build().ainvoke(messages, **kw)
        except Exception as e:
            if _is_quota_error(e):
                self._cooldown_until = time.time() + _COOLDOWN_SECONDS
                logger.warning("DeepSeek rate limit — cooldown %ds", _COOLDOWN_SECONDS)
            raise


# ─── Multi-provider façade ────────────────────────────────────────────────────

# Per-provider default models — used when the façade is built with a Gemini
# model name (e.g. the personalizer's hard-coded "gemini-2.5-flash").
_GROQ_DEFAULT = "llama-3.3-70b-versatile"
_DEEPSEEK_DEFAULT = "deepseek-chat"


class RotatingLLM:
    """
    Drop-in replacement for the previous single-provider RotatingLLM.
    Tries the primary provider first, falls back to the other on quota errors.
    """

    def __init__(
        self,
        model: str = "gemini-2.5-flash",
        structured_schema: Any = None,
        **kwargs: Any,
    ):
        self._schema = structured_schema
        self._kwargs = kwargs
        self._model_req = model

        primary = os.getenv("LLM_PROVIDER", "").lower().strip()
        if not primary:
            if os.getenv("DEEPSEEK_API_KEY"):
                primary = "deepseek"
            elif os.getenv("GROQ_API_KEY"):
                primary = "groq"
            else:
                primary = "gemini"

        self._deepseek = _DeepSeekClient(
            model=_DEEPSEEK_DEFAULT if model.startswith("gemini") else model,
            structured_schema=structured_schema,
            **kwargs,
        )
        self._groq = _GroqClient(
            model=_GROQ_DEFAULT if model.startswith("gemini") else model,
            structured_schema=structured_schema,
            **kwargs,
        )
        self._gemini = _GeminiRotator(
            model=model if model.startswith("gemini") else "gemini-2.5-flash",
            structured_schema=structured_schema,
            **kwargs,
        )

        clients = {
            "deepseek": self._deepseek,
            "groq": self._groq,
            "gemini": self._gemini,
        }
        # Primary first, then the remaining providers as fallbacks.
        fallbacks = [p for p in ("deepseek", "groq", "gemini") if p != primary]
        order = [clients.get(primary, self._gemini)] + [clients[p] for p in fallbacks]
        self._order = [
            c for c in order
            if c.available() or (isinstance(c, _GeminiRotator) and c._keys)
        ]
        if not self._order:
            # still keep the list even if all unavailable — will raise on invoke
            self._order = list(order)

        logger.info(
            "RotatingLLM model=%s primary=%s deepseek=%s groq=%s gemini_keys=%d",
            model,
            primary,
            bool(self._deepseek._key),
            bool(self._groq._key),
            len(self._gemini._keys),
        )

    def with_structured_output(self, schema: Any) -> "RotatingLLM":
        return RotatingLLM(
            model=self._model_req, structured_schema=schema, **self._kwargs
        )

    async def ainvoke(self, messages: Any, **kw: Any) -> Any:
        last: Optional[Exception] = None
        for client in self._order:
            try:
                return await client.ainvoke(messages, **kw)
            except Exception as e:
                last = e
                if _is_quota_error(e):
                    logger.warning(
                        "Provider %s exhausted — trying fallback", type(client).__name__
                    )
                    continue
                raise
        assert last is not None
        raise last

    def invoke(self, messages: Any, **kw: Any) -> Any:
        # Sync path — only Gemini supports sync here; Groq path goes async-only.
        return asyncio.get_event_loop().run_until_complete(self.ainvoke(messages, **kw))


_singletons: dict[str, RotatingLLM] = {}


def get_rotating_llm(model: str = "gemini-2.5-flash") -> RotatingLLM:
    if model not in _singletons:
        _singletons[model] = RotatingLLM(model=model)
    return _singletons[model]
