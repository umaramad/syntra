from typing import Any, Optional

from mcp.tools.base_tool import BaseMCPTool
from services.task_service import TaskService


class ListTasksTool(BaseMCPTool):
    tool_key = "list_tasks"
    name = "List Tasks"
    description = "List recent tasks."
    input_schema = {
        "type": "object",
        "properties": {
            "limit": {"type": "integer", "description": "Maximum number of tasks to return"},
        },
    }

    def __init__(self, task_service: Optional[TaskService] = None):
        self.task_service = task_service or TaskService()

    def execute(self, input_text: str, payload: Optional[dict[str, Any]] = None) -> dict:
        data = payload or {}
        limit = int(data.get("limit", 20))
        tasks = self.task_service.recent_tasks(limit=limit)
        return {
            "count": len(tasks),
            "tasks": [task.to_dict() for task in tasks],
        }
