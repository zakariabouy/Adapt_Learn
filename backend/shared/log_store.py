from collections import deque
from typing import List, Dict, Any
import datetime

# Store the last 50 orchestrator traces in memory for the God Mode panel
class LogStore:
    def __init__(self, maxlen=50):
        self._logs = deque(maxlen=maxlen)

    def add_log(self, node: str, message: str, state_update: Dict[str, Any] = None):
        log_entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "node": node,
            "message": message,
            "state_update": state_update or {}
        }
        self._logs.appendleft(log_entry)

    def get_logs(self) -> List[Dict[str, Any]]:
        return list(self._logs)

# Singleton instance
orchestrator_logs = LogStore()
