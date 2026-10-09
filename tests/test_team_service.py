import sqlite3

import pytest

from database.db import get_db
from repositories.reminder_repository import ReminderRepository
from repositories.task_comment_repository import TaskCommentRepository
from repositories.team_repository import TeamRepository
from repositories.user_profile_repository import UserProfileRepository
from services.team_service import TeamService


def _assign_member_everywhere(task, member):
    reminder = ReminderRepository().create_reminder(
        {
            "title": "Standup",
            "remind_at": "2026-01-01 09:00:00",
            "assigned_to": member.id,
        }
    )
    comment = TaskCommentRepository().create_comment(
        {
            "task_id": task.id,
            "comment": "Working on it",
            "author_name": member.name,
            "status": "in_progress",
            "assigned_to": member.id,
        }
    )
    profile = UserProfileRepository().upsert_profile(
        {
            "display_name": member.name,
            "team_member_id": member.id,
            "updated_at": "2026-01-01 09:00:00",
        }
    )
    return reminder, comment, profile


def test_delete_member_without_references(db_path, team_member):
    service = TeamService()

    assert service.delete_member(team_member.id) is True
    assert TeamRepository().find_by_id(team_member.id) is None


def test_delete_missing_member_returns_false(db_path):
    assert TeamService().delete_member(9999) is False


def test_delete_member_clears_all_references(db_path, task, team_member):
    reminder, comment, profile = _assign_member_everywhere(task, team_member)

    assert TeamService().delete_member(team_member.id) is True

    with get_db() as conn:
        row = conn.execute(
            "SELECT assigned_to FROM tasks WHERE id = ?", (task.id,)
        ).fetchone()
        assert row["assigned_to"] is None

        row = conn.execute(
            "SELECT assigned_to FROM reminders WHERE id = ?", (reminder.id,)
        ).fetchone()
        assert row["assigned_to"] is None

        row = conn.execute(
            "SELECT assigned_to FROM task_comments WHERE id = ?", (comment.id,)
        ).fetchone()
        assert row["assigned_to"] is None

        row = conn.execute(
            "SELECT team_member_id FROM user_profile WHERE id = ?", (profile.id,)
        ).fetchone()
        assert row["team_member_id"] is None

        row = conn.execute(
            "SELECT COUNT(*) AS total FROM team_members WHERE id = ?",
            (team_member.id,),
        ).fetchone()
        assert row["total"] == 0


def test_delete_member_still_referenced_raises_value_error(db_path, team_member):
    """Safety net: an unknown referencing table yields ValueError, not IntegrityError."""
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE member_badges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES team_members(id)
            )
            """
        )
        conn.execute(
            "INSERT INTO member_badges (member_id) VALUES (?)",
            (team_member.id,),
        )

    with pytest.raises(ValueError, match="still referenced"):
        TeamService().delete_member(team_member.id)

    assert TeamRepository().find_by_id(team_member.id) is not None


def test_delete_member_works_with_legacy_schema(db_path, team_member):
    """Databases created before ON DELETE SET NULL still had NO ACTION FKs."""
    with get_db() as conn:
        conn.execute("DROP TABLE reminders")
        conn.execute(
            """
            CREATE TABLE reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                remind_at TEXT NOT NULL,
                assigned_to INTEGER,
                status TEXT DEFAULT 'pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assigned_to) REFERENCES team_members(id)
            )
            """
        )
        conn.execute(
            "INSERT INTO reminders (title, remind_at, assigned_to) VALUES (?, ?, ?)",
            ("Standup", "2026-01-01 09:00:00", team_member.id),
        )

    # Confirm the legacy FK really does block a plain DELETE (the original bug).
    with pytest.raises(sqlite3.IntegrityError):
        with get_db() as conn:
            conn.execute(
                "DELETE FROM team_members WHERE id = ?", (team_member.id,)
            )

    assert TeamService().delete_member(team_member.id) is True

    with get_db() as conn:
        row = conn.execute("SELECT assigned_to FROM reminders").fetchone()
        assert row["assigned_to"] is None
        row = conn.execute(
            "SELECT COUNT(*) AS total FROM team_members WHERE id = ?",
            (team_member.id,),
        ).fetchone()
        assert row["total"] == 0


def test_delete_member_route_returns_success(db_path, task, team_member):
    from app import create_app

    _assign_member_everywhere(task, team_member)

    client = create_app().test_client()
    response = client.delete(f"/api/team/{team_member.id}")

    assert response.status_code == 200
    assert response.get_json() == {"success": True}
    assert TeamRepository().find_by_id(team_member.id) is None


def test_delete_member_route_returns_404_for_missing(db_path):
    from app import create_app

    client = create_app().test_client()
    response = client.delete("/api/team/9999")

    assert response.status_code == 404
    assert response.get_json()["error"] == "Member not found"
