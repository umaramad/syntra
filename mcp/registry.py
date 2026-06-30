from typing import Optional, Type

from mcp.tools.assign_task_tool import AssignTaskTool
from mcp.tools.base_tool import BaseMCPTool
from mcp.tools.create_note_tool import CreateNoteTool
from mcp.tools.create_task_tool import CreateTaskTool
from mcp.tools.list_notes_tool import ListNotesTool
from mcp.tools.list_tasks_tool import ListTasksTool


class MCPRegistry:
    DEFAULT_TOOLS: dict[str, Type[BaseMCPTool]] = {
        "create_task": CreateTaskTool,
        "create_note": CreateNoteTool,
        "list_tasks": ListTasksTool,
        "list_notes": ListNotesTool,
        "assign_task": AssignTaskTool,
    }

    def __init__(self):
        self._tools: dict[str, BaseMCPTool] = {}
        for tool_key, tool_class in self.DEFAULT_TOOLS.items():
            self.register(tool_key, tool_class)

    def register(self, tool_key: str, tool_class: Type[BaseMCPTool]) -> None:
        tool = tool_class()
        if tool.tool_key != tool_key:
            raise ValueError(
                f"Tool key mismatch: expected '{tool_key}', got '{tool.tool_key}'"
            )
        self._tools[tool_key] = tool

    def get_tool(self, tool_key: str) -> Optional[BaseMCPTool]:
        return self._tools.get(tool_key)

    def list_tools(self) -> list[BaseMCPTool]:
        return list(self._tools.values())
