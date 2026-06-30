import pytest

from services.task_comment_service import TaskCommentService


def test_add_comment_requires_team_member(db_path, task, team_member):
    service = TaskCommentService()

    with pytest.raises(ValueError, match="Team member is required"):
        service.add_comment(task.id, "Update", assigned_to=None)


def test_add_comment_rejects_invalid_status(db_path, task, team_member):
    service = TaskCommentService()

    with pytest.raises(ValueError, match="Invalid status"):
        service.add_comment(
            task.id,
            "Update",
            status="blocked",
            assigned_to=team_member.id,
        )


def test_add_and_update_comment(db_path, task, team_member):
    service = TaskCommentService()

    created = service.add_comment(
        task.id,
        "Started work",
        status="in_progress",
        assigned_to=team_member.id,
    )
    assert created.comment == "Started work"
    assert created.status == "in_progress"

    updated = service.update_comment(
        task.id,
        created.id,
        "Finished work",
        status="done",
        assigned_to=team_member.id,
    )
    assert updated.comment == "Finished work"
    assert updated.status == "done"


def test_list_comments_returns_none_for_missing_task(db_path):
    assert TaskCommentService().list_comments(9999) is None
