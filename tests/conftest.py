"""Shared pytest fixtures with an isolated SQLite database per test."""

import tempfile
from pathlib import Path

import pytest

import config
from database.db import get_db, init_db
from repositories.task_repository import TaskRepository
from repositories.team_repository import TeamRepository


@pytest.fixture()
def db_path(monkeypatch):
    with tempfile.TemporaryDirectory() as tmpdir:
        path = str(Path(tmpdir) / "test.db")
        monkeypatch.setattr(config, "DATABASE_PATH", path)
        init_db()
        yield path


@pytest.fixture()
def team_member(db_path):
    return TeamRepository().create_member(
        {"name": "Alex", "role": "Engineer", "email": "alex@example.com"}
    )


@pytest.fixture()
def task(db_path, team_member):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM task_groups WHERE name = ?", ("General",)
        ).fetchone()
        group_id = row["id"]

    return TaskRepository().create_task(
        {
            "title": "Test task",
            "group_id": group_id,
            "assigned_to": team_member.id,
        }
    )
