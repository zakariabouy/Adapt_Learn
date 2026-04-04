import asyncio
import json
from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from shared.models import TelemetryEvent, AdaptationCommand, EngagementState
from agents.monitor.agent import classify_engagement, should_trigger

router = APIRouter(prefix="/session", tags=["Session"])

# Global event queue for the orchestrator
event_queue = asyncio.Queue()

# Simple connection manager for active WebSockets
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, student_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[student_id] = websocket

    def disconnect(self, student_id: str):
        if student_id in self.active_connections:
            del self.active_connections[student_id]

    async def send_personal_message(self, message: str, student_id: str):
        if student_id in self.active_connections:
            await self.active_connections[student_id].send_text(message)

manager = ConnectionManager()

@router.websocket("/{student_id}")
async def websocket_endpoint(websocket: WebSocket, student_id: str):
    await manager.connect(student_id, websocket)
    
    # Task to listen for AdaptationCommands from the orchestrator and send them to the student
    # For now, we'll use a local queue for this specific session's commands
    command_queue = asyncio.Queue()
    
    async def receive_telemetry():
        try:
            while True:
                data = await websocket.receive_json()
                event = TelemetryEvent(**data)
                
                # Classify engagement
                state = classify_engagement(event)
                
                # If it's a critical state, push to orchestrator queue
                if should_trigger(state):
                    await event_queue.put(event)
                    
        except WebSocketDisconnect:
            manager.disconnect(student_id)
        except Exception as e:
            print(f"Error in telemetry receiver: {e}")
            manager.disconnect(student_id)

    async def send_commands():
        try:
            while True:
                # In a real scenario, the orchestrator would push to this command_queue
                # For this implementation, we follow the instruction to listen for AdaptationCommands
                command = await command_queue.get()
                if isinstance(command, AdaptationCommand):
                    await websocket.send_json(command.dict())
                command_queue.task_done()
        except WebSocketDisconnect:
            pass
        except Exception as e:
            print(f"Error in command sender: {e}")

    # Run both tasks concurrently
    try:
        await asyncio.gather(receive_telemetry(), send_commands())
    except Exception:
        manager.disconnect(student_id)

# Note: In a complete system, there would be a mechanism to link the global event_queue 
# to the orchestrator and route commands back to the specific command_queue or WebSocket.
