import pytest

from services.reminder_service import ReminderService


def test_create_reminder_requires_title(db_path):
    with pytest.raises(ValueError, match="title is required"):
        ReminderService().create_reminder("", "2026-06-30T10:00:00")


def test_create_and_update_reminder(db_path, team_member):
    service = ReminderService()

    reminder = service.create_reminder(
        "Standup",
        "2026-06-30T09:00:00",
        assigned_to=team_member.id,
    )
    assert reminder.title == "Standup"
    assert reminder.status == "pending"

    updated = service.update_reminder(
        reminder.id,
        status="sent",
    )
    assert updated.status == "sent"


def test_update_reminder_rejects_invalid_assignee(db_path):
    service = ReminderService()
    reminder = service.create_reminder("Ping", "2026-06-30T09:00:00")

    with pytest.raises(ValueError, match="Assigned team member not found"):
        service.update_reminder(
            reminder.id,
            assigned_to=9999,
            update_assignee=True,
        )
