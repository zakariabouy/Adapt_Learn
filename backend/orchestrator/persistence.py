import json
import logging
from typing import List, Optional
from shared.database import get_redis
from shared.models import AdaptationCommand, EngagementState

logger = logging.getLogger(__name__)


class SessionStatePersistence:
    """
    Handles persisting and recovering session state (Adaptation History) using Redis.
    All methods degrade gracefully if Redis is unavailable.
    """

    @staticmethod
    def _get_key(student_id: str) -> str:
        return f"session_state:{student_id}"

    @classmethod
    async def save_state(cls, student_id: str, last_state: EngagementState, history: List[dict]):
        """Saves current session metadata to Redis. No-ops silently if Redis is down."""
        try:
            redis = await get_redis()
            if redis is None:
                return
            data = {
                "last_engagement_state": last_state.value,
                "adaptation_history": history
            }
            await redis.set(cls._get_key(student_id), json.dumps(data), ex=7200)
        except Exception as e:
            logger.warning("Redis save_state failed for %s (non-fatal): %s", student_id, e)

    @classmethod
    async def get_state(cls, student_id: str) -> Optional[dict]:
        """Recovers session metadata from Redis. Returns None if Redis is down."""
        try:
            redis = await get_redis()
            if redis is None:
                return None
            raw = await redis.get(cls._get_key(student_id))
            if not raw:
                return None
            return json.loads(raw)
        except Exception as e:
            logger.warning("Redis get_state failed for %s (non-fatal): %s", student_id, e)
            return None

    @classmethod
    async def add_to_history(cls, student_id: str, command: AdaptationCommand):
        """Appends a new adaptation command to the session history. No-ops if Redis is down."""
        try:
            state = await cls.get_state(student_id) or {
                "last_engagement_state": "neutral",
                "adaptation_history": []
            }
            history = state["adaptation_history"]
            history.append({
                "action": command.action,
                "reason": command.reason,
                "data": command.data,
            })
            state["adaptation_history"] = history[-10:]
            await cls.save_state(
                student_id,
                EngagementState(state["last_engagement_state"]),
                state["adaptation_history"]
            )
        except Exception as e:
            logger.warning("Redis add_to_history failed for %s (non-fatal): %s", student_id, e)
