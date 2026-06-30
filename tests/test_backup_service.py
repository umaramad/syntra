import pytest

from database.db import get_db
from repositories.task_repository import TaskRepository
from services.backup_service import BACKUP_FORMAT, BACKUP_TABLES, BACKUP_VERSION, BackupService


def test_export_backup_structure(db_path):
    backup = BackupService().export_backup()

    assert backup["format"] == BACKUP_FORMAT
    assert backup["version"] == BACKUP_VERSION
    assert backup["app"] == "Syntra"
    assert backup["exported_at"]
    assert set(backup["tables"].keys()) == set(BACKUP_TABLES)
    for table_name in BACKUP_TABLES:
        assert isinstance(backup["tables"][table_name], list)


def test_export_backup_includes_workspace_data(db_path, team_member):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM task_groups WHERE name = ?", ("General",)
        ).fetchone()
        group_id = row["id"]

    TaskRepository().create_task(
        {
            "title": "Ship backup",
            "group_id": group_id,
            "assigned_to": team_member.id,
        }
    )

    backup = BackupService().export_backup()

    assert len(backup["tables"]["team_members"]) >= 1
    assert len(backup["tables"]["task_groups"]) >= 1
    assert any(task["title"] == "Ship backup" for task in backup["tables"]["tasks"])


def test_import_backup_restores_workspace(db_path, team_member):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM task_groups WHERE name = ?", ("General",)
        ).fetchone()
        group_id = row["id"]

    TaskRepository().create_task(
        {
            "title": "Restore me",
            "group_id": group_id,
            "assigned_to": team_member.id,
        }
    )

    service = BackupService()
    backup = service.export_backup()

    with get_db() as conn:
        conn.execute("DELETE FROM task_comments")
        conn.execute("DELETE FROM tasks")

    assert not TaskRepository().find_all()

    result = service.import_backup(backup)

    assert result["imported_at"]
    assert result["tables"]["tasks"] >= 1
    restored = TaskRepository().find_all()
    assert any(task.title == "Restore me" for task in restored)


def test_import_backup_rejects_invalid_format(db_path):
    with pytest.raises(ValueError, match="Unsupported backup format"):
        BackupService().import_backup({"format": "other", "version": 1, "tables": {}})


def test_import_backup_rejects_invalid_version(db_path):
    with pytest.raises(ValueError, match="Unsupported backup version"):
        BackupService().import_backup(
            {"format": BACKUP_FORMAT, "version": 99, "tables": {}}
        )
