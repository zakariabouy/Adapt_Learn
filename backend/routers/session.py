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
    content_id: str = Query(default=None)
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
    
    pool = await get_pool()
    session_id = None
    
    # Session Metrics
    telemetry_events_count: int = 0
    total_scroll_velocity: float = 0.0
    total_frustration_score: float = 0.0
    adaptations_applied: list = []

    try:
        # 1. Initialize DB Session
        try:
            session_id = await pool.fetchval(
                """
                INSERT INTO sessions (student_id, content_id, started_at)
                VALUES ($1, $2, NOW())
                RETURNING id
                """,
                UUID(student_id),
                UUID(content_id) if content_id else None
            )
        except Exception as e:
            logger.error(f"Failed to create DB session for student {student_id}: {e}")

        # Initial: Try to recover previous session state
        recovered = await SessionStatePersistence.get_state(student_id)
        if recovered:
            logger.info(f"Recovered session for {student_id} with {len(recovered['adaptation_history'])} past commands")

        while True:
            data = await websocket.receive_json()
            event = TelemetryEvent(**data)
            
            # Accumulate Metrics
            telemetry_events_count += 1
            total_scroll_velocity += event.scrollVelocity

            # Classify engagement
            state = classify_engagement(event)
            if state == EngagementState.FRUSTRATED:
                total_frustration_score += 1.0

            # If it's a critical state, trigger an adaptation response (rate-limited)
            if should_trigger(state) and manager.can_trigger(student_id):
                logger.info("Adaptation triggered for student %s — state: %s", student_id, state.value)
                
                # Retrieve session history before calling strategy
                state_data = await SessionStatePersistence.get_state(student_id)
                history = state_data.get("adaptation_history", []) if state_data else []
                
                command = await get_strategic_command(student_id, state, event, session_history=history)
                
                if command.action != "no_action":
                    # Track applied adaptation
                    adaptations_applied.append(command.model_dump())
                    
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
        
        # 2. Finalize DB Session
        if session_id:
            try:
                summary = {
                    "event_count": telemetry_events_count,
                    "avg_scroll_velocity": round(
                        total_scroll_velocity / telemetry_events_count, 2
                    ) if telemetry_events_count > 0 else 0,
                    "current_frustration_level": round(
                        total_frustration_score / telemetry_events_count, 3
                    ) if telemetry_events_count > 0 else 0,
                }
                
                await pool.execute(
                    """
                    UPDATE sessions
                    SET ended_at = NOW(),
                        telemetry_summary = $1,
                        adaptations_applied = $2
                    WHERE id = $3
                    """,
                    json.dumps(summary),
                    [json.dumps(a) for a in adaptations_applied],
                    session_id
                )
            except Exception as e:
                logger.error(f"Failed to finalize DB session {session_id} for student {student_id}: {e}")
