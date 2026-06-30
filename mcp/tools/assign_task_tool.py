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
            "task_title": {"type": "string", "description": "Task title or substring"},
            "assignee_name": {"type": "string", "description": "Team member name"},
        },
    }

    def __init__(self, task_service: Optional[TaskService] = None):
        self.task_service = task_service or TaskService()

    def execute(self, input_text: str, payload: Optional[dict[str, Any]] = None) -> dict:
        data = payload or {}
        task_id = data.get("task_id")
        assignee_id = data.get("assignee_id")
        task_title = data.get("task_title")
        assignee_name = data.get("assignee_name")

        if task_id is not None:
            task_id = int(task_id)
        if assignee_id is not None:
            assignee_id = int(assignee_id)

        has_task = task_id is not None or task_title
        has_assignee = assignee_id is not None or assignee_name
        if not has_task and not has_assignee and not input_text.strip():
            return {
                "message": "Provide task and assignee details to assign a task.",
                "input_text": input_text.strip(),
                "payload": data,
            }

        try:
            task = self.task_service.assign_task(
                task_id=task_id,
                assignee_id=assignee_id,
                assignee_name=assignee_name,
                task_title=task_title,
                input_text=input_text,
            )
            return task.to_dict()
        except ValueError as exc:
            return {"error": str(exc)}
