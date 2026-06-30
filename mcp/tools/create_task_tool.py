from typing import Any, Optional

from mcp.tools.base_tool import BaseMCPTool
from services.task_service import TaskService

TASK_PREFIXES = (
    "create task",
    "add task",
    "new task",
    "create todo",
    "add todo",
    "new todo",
    "remind me to",
)


def extract_task_title(input_text: str, payload: Optional[dict[str, Any]] = None) -> str:
    if payload and payload.get("title"):
        return str(payload["title"]).strip()

    text = input_text.strip()
    if not text:
        return "Untitled task"

    lower = text.lower()
    for prefix in TASK_PREFIXES:
        if lower.startswith(prefix):
            title = text[len(prefix) :].strip(" :-")
            return title or "Untitled task"

    return text


class CreateTaskTool(BaseMCPTool):
    tool_key = "create_task"
    name = "Create Task"
    description = "Create a new task with a title and optional description."
    input_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Task title"},
            "description": {"type": "string", "description": "Task description"},
        },
    }

    def __init__(self, task_service: Optional[TaskService] = None):
        self.task_service = task_service or TaskService()

    def execute(self, input_text: str, payload: Optional[dict[str, Any]] = None) -> dict:
        data = payload or {}
        title = extract_task_title(input_text, data)
        task = self.task_service.create_task(
            title=title,
            description=data.get("description"),
            priority=data.get("priority", "medium"),
            due_date=data.get("due_date"),
            group_name=data.get("group_name") or TaskService.DEFAULT_GROUP_NAME,
        )
        return task.to_dict()
