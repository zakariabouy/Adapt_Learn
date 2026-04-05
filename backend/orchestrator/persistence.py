import json
from typing import List, Optional
from shared.database import get_redis
from shared.models import AdaptationCommand, EngagementState

class SessionStatePersistence:
    """
    Handles persisting and recovering session state (Adaptation History) using Redis.
    """
    
    @staticmethod
    def _get_key(student_id: str) -> str:
        return f"session_state:{student_id}"

    @classmethod
    async def save_state(cls, student_id: str, last_state: EngagementState, history: List[dict]):
        """
        Saves current session metadata to Redis.
        """
        redis = await get_redis()
        data = {
            "last_engagement_state": last_state.value,
            "adaptation_history": history
        }
        # Expire session state after 2 hours of inactivity
        await redis.set(cls._get_key(student_id), json.dumps(data), ex=7200)

    @classmethod
    async def get_state(cls, student_id: str) -> Optional[dict]:
        """
        Recovers session metadata from Redis.
        """
        redis = await get_redis()
        raw = await redis.get(cls._get_key(student_id))
        if not raw:
            return None
        return json.loads(raw)

    @classmethod
    async def add_to_history(cls, student_id: str, command: AdaptationCommand):
        """
        Appends a new adaptation command to the session history in Redis.
        """
        state = await cls.get_state(student_id) or {"last_engagement_state": "neutral", "adaptation_history": []}
        
        # Keep only last 10 commands for context
        history = state["adaptation_history"]
        history.append({
            "action": command.action,
            "reason": command.reason,
            "data": command.data,
            "timestamp": "now" # In a full system we'd use ISO strings
        })
        
        state["adaptation_history"] = history[-10:]
        await cls.save_state(student_id, EngagementState(state["last_engagement_state"]), state["adaptation_history"])
