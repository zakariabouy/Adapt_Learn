import asyncio
import json
import logging
import time
from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt
from shared.models import TelemetryEvent, AdaptationCommand, EngagementState
from shared.security import SECRET_KEY, ALGORITHM
from shared.database import get_pool
from agents.monitor.agent import classify_engagement, should_trigger
from orchestrator.strategy import get_strategic_command
from orchestrator.persistence import SessionStatePersistence

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/session", tags=["Session"])

ADAPTATION_COOLDOWN_SECONDS = 10.0


class ConnectionManager:
    """Manages active WebSocket connections keyed by student_id."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self._last_trigger: Dict[str, float] = {}

    async def connect(self, student_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[student_id] = websocket

    def disconnect(self, student_id: str):
        self.active_connections.pop(student_id, None)
        self._last_trigger.pop(student_id, None)

    def can_trigger(self, student_id: str) -> bool:
        """Returns True and records the time if the cooldown has elapsed."""
        now = time.monotonic()
        if now - self._last_trigger.get(student_id, 0.0) >= ADAPTATION_COOLDOWN_SECONDS:
            self._last_trigger[student_id] = now
            return True
        return False

    async def send_command(self, student_id: str, command: AdaptationCommand):
        ws = self.active_connections.get(student_id)
        if ws:
            await ws.send_json(command.model_dump())


manager = ConnectionManager()


async def authenticate_websocket(token: str) -> str | None:
    """Validate JWT token and return the user email, or None if invalid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            return None
        # Verify user still exists
        pool = await get_pool()
        user = await pool.fetchrow("SELECT id FROM users WHERE email = $1", email)
        if not user:
            return None
        return str(user["id"])
    except JWTError:
        return None


@router.websocket("/{student_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    student_id: str,
    token: str = Query(default=None),
):
    # --- Auth gate ---
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    authenticated_user_id = await authenticate_websocket(token)
    if not authenticated_user_id or authenticated_user_id != student_id:
        await websocket.close(code=4003, reason="Unauthorized")
        return

    # --- Connected ---
    await manager.connect(student_id, websocket)

    try:
        # Initial: Try to recover previous session state
        recovered = await SessionStatePersistence.get_state(student_id)
        if recovered:
            print(f"Recovered session for {student_id} with {len(recovered['adaptation_history'])} past commands")

        while True:
            data = await websocket.receive_json()
            event = TelemetryEvent(**data)

            # Classify engagement
            state = classify_engagement(event)

            # If it's a critical state, trigger an adaptation response (rate-limited)
            if should_trigger(state) and manager.can_trigger(student_id):
                logger.info("Adaptation triggered for student %s — state: %s", student_id, state.value)
                command = await get_strategic_command(student_id, state, event)
                
                if command.action != "no_action":
                    # Persist to Redis history
                    await SessionStatePersistence.add_to_history(student_id, command)
                    # Send to frontend
                    await manager.send_command(student_id, command)
                else:
                    # Just update the last engagement state in Redis
                    await SessionStatePersistence.save_state(student_id, state, recovered["adaptation_history"] if recovered else [])

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception("WebSocket error for student %s: %s", student_id, e)
    finally:
        manager.disconnect(student_id)
