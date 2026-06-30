from typing import Any, Optional

from mcp.tools.base_tool import BaseMCPTool
from services.task_service import TaskService


class AssignTaskTool(BaseMCPTool):
    tool_key = "assign_task"
    name = "Assign Task"
    description = "Assign a task to a team member."
    input_schema = {
        "type": "object",
        "properties": {
            "task_id": {"type": "integer", "description": "Task ID"},
            "assignee_id": {"type": "integer", "description": "Team member ID"},
        },
    }

    def __init__(self, task_service: Optional[TaskService] = None):
        self.task_service = task_service or TaskService()

    def execute(self, input_text: str, payload: Optional[dict[str, Any]] = None) -> dict:
        data = payload or {}
        task_id = data.get("task_id")
        assignee_id = data.get("assignee_id")

        if task_id is None or assignee_id is None:
            return {
                "message": "Task ID and assignee ID are required for assignment.",
                "input_text": input_text.strip(),
                "payload": data,
            }

        task = self.task_service.update_task(
            int(task_id),
            assigned_to=int(assignee_id),
            update_assignee=True,
        )
        if not task:
            return {"error": "Task not found"}

        return task.to_dict()
