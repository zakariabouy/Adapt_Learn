"""
Rotating Gemini LLM wrapper.

Multiple GOOGLE_API_KEY* env vars are pooled. Each .ainvoke() picks the next
key in round-robin order; on a 429/quota error the key is parked in cooldown
and the call retries with the next available key. Demos survive RPM spikes.

Env vars read: GOOGLE_API_KEY, GOOGLE_API_KEY_2, GOOGLE_API_KEY_3, ...
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


def _load_keys() -> List[str]:
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
    return any(s in msg for s in ("429", "quota", "resource_exhausted", "resourceexhausted", "rate limit"))


class RotatingLLM:
    def __init__(self, model: str = "gemini-2.5-flash", structured_schema: Any = None, **kwargs: Any):
        self._model = model
        self._kwargs = kwargs
        self._schema = structured_schema
        self._keys = _load_keys()
        if not self._keys:
            raise RuntimeError("No GOOGLE_API_KEY* environment variables set")
        self._idx = 0
        self._cooldown_until = [0.0] * len(self._keys)
        logger.info("RotatingLLM initialized model=%s keys=%d", model, len(self._keys))

    def _build(self, key: str):
        llm = ChatGoogleGenerativeAI(model=self._model, google_api_key=key, **self._kwargs)
        if self._schema is not None:
            llm = llm.with_structured_output(self._schema)
        return llm

    def with_structured_output(self, schema: Any) -> "RotatingLLM":
        return RotatingLLM(model=self._model, structured_schema=schema, **self._kwargs)

    def _pick_key(self) -> Optional[int]:
        now = time.time()
        n = len(self._keys)
        for offset in range(n):
            i = (self._idx + offset) % n
            if self._cooldown_until[i] <= now:
                return i
        return None

    def _mark_cooldown(self, i: int) -> None:
        self._cooldown_until[i] = time.time() + _COOLDOWN_SECONDS
        logger.warning("Gemini key #%d in cooldown for %ds (quota)", i + 1, _COOLDOWN_SECONDS)

    async def ainvoke(self, messages: Any, **kw: Any) -> Any:
        n = len(self._keys)
        last_err: Optional[Exception] = None
        for _ in range(n):
            i = self._pick_key()
            if i is None:
                wait = max(0.5, min(self._cooldown_until) - time.time())
                logger.warning("All Gemini keys cooled; sleeping %.1fs", wait)
                await asyncio.sleep(min(wait, 5))
                i = self._pick_key() or 0
            self._idx = (i + 1) % n
            try:
                return await self._build(self._keys[i]).ainvoke(messages, **kw)
            except Exception as e:
                last_err = e
                if _is_quota_error(e):
                    self._mark_cooldown(i)
                    continue
                raise
        assert last_err is not None
        raise last_err

    def invoke(self, messages: Any, **kw: Any) -> Any:
        n = len(self._keys)
        last_err: Optional[Exception] = None
        for _ in range(n):
            i = self._pick_key() or 0
            self._idx = (i + 1) % n
            try:
                return self._build(self._keys[i]).invoke(messages, **kw)
            except Exception as e:
                last_err = e
                if _is_quota_error(e):
                    self._mark_cooldown(i)
                    continue
                raise
        assert last_err is not None
        raise last_err


_singletons: dict[str, RotatingLLM] = {}


def get_rotating_llm(model: str = "gemini-2.5-flash") -> RotatingLLM:
    if model not in _singletons:
        _singletons[model] = RotatingLLM(model=model)
    return _singletons[model]
