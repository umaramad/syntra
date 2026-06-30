from models.mcp_tool import MCPTool
from services.tool_matcher_service import ToolMatcherService


def _tool(**overrides):
    defaults = {
        "id": 1,
        "name": "Create Task",
        "tool_key": "create_task",
        "description": "Create a task",
        "keywords": "create,add,new,task,todo",
        "patterns": "create task,add task,new task",
        "enabled": True,
        "created_at": None,
    }
    defaults.update(overrides)
    return MCPTool(**defaults)


def test_match_create_task_pattern():
    matcher = ToolMatcherService()
    result = matcher.match("please create task deploy fix", [_tool()])

    assert result.get("no_match") is not True
    assert result["tool_key"] == "create_task"
    assert result["confidence"] >= 60


def test_match_returns_no_match_below_threshold():
    matcher = ToolMatcherService()
    result = matcher.match("hello world", [_tool()])

    assert result["no_match"] is True
    assert result["confidence"] < 60


def test_extract_args_create_task():
    matcher = ToolMatcherService()
    args = matcher.extract_args("create task Fix login bug", "create_task", [_tool()])

    assert "Fix login bug" in args["title"]
