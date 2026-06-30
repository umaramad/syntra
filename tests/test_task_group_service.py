import pytest

from database.db import get_db
from mcp.tools.create_task_tool import CreateTaskTool
from services.task_group_service import TaskGroupService


def _general_group_id() -> int:
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM task_groups WHERE name = ?", ("General",)
        ).fetchone()
    return row["id"]


def test_get_or_create_group_reuses_active_group(db_path):
    service = TaskGroupService()
    first = service.get_or_create_group("General")
    second = service.get_or_create_group("General")
    assert second.id == first.id


def test_get_or_create_group_restores_archived_group(db_path):
    service = TaskGroupService()
    group_id = _general_group_id()
    service.archive_group(group_id)

    restored = service.get_or_create_group("General")

    assert restored.id == group_id
    assert restored.archived is False


def test_create_task_via_mcp_after_general_archived(db_path):
    service = TaskGroupService()
    service.archive_group(_general_group_id())

    task = CreateTaskTool().execute("create task Ship release")

    assert task["title"] == "Ship release"
    assert task["group_name"] == "General"


def test_create_group_rejects_archived_name(db_path):
    service = TaskGroupService()
    service.archive_group(_general_group_id())

    with pytest.raises(ValueError, match="Archive"):
        service.create_group("General")
