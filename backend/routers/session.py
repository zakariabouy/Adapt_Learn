import asyncio
import json
from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt
from shared.models import TelemetryEvent, AdaptationCommand
from shared.security import SECRET_KEY, ALGORITHM
from shared.database import get_pool
from agents.monitor.agent import classify_engagement, should_trigger

router = APIRouter(prefix="/session", tags=["Session"])


class ConnectionManager:
    """Manages active WebSocket connections keyed by student_id."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, student_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[student_id] = websocket

    def disconnect(self, student_id: str):
        self.active_connections.pop(student_id, None)

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
        while True:
            data = await websocket.receive_json()
            event = TelemetryEvent(**data)

            # Classify engagement
            state = classify_engagement(event)

            # If it's a critical state, trigger an adaptation response
            if should_trigger(state):
                # Build a command based on the engagement state
                command = build_adaptation_command(state)
                await manager.send_command(student_id, command)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error for {student_id}: {e}")
    finally:
        manager.disconnect(student_id)


def build_adaptation_command(state) -> AdaptationCommand:
    """Map engagement states to concrete adaptation commands.

    In Phase 4 this will be replaced by the LangGraph orchestrator's
    plan_node output. For now we use deterministic rules so the
    frontend can react immediately.
    """
    from shared.models import EngagementState

    match state:
        case EngagementState.DISTRACTED:
            return AdaptationCommand(
                action="switch_modality",
                data={"modality": "audio"},
                reason="Student appears distracted — switching to audio mode",
            )
        case EngagementState.FRUSTRATED:
            return AdaptationCommand(
                action="simplify_content",
                data={"reduce_chunk_size": True, "simplify_text": True},
                reason="Student appears frustrated — simplifying content",
            )
        case EngagementState.BORED:
            return AdaptationCommand(
                action="switch_modality",
                data={"modality": "visual"},
                reason="Student appears bored — switching to visual diagram",
            )
        case _:
            return AdaptationCommand(
                action="no_action",
                reason="No intervention needed",
            )
