from typing import Optional

from models.reminder import Reminder
from repositories.reminder_repository import ReminderRepository
from repositories.team_repository import TeamRepository


class ReminderService:
    VALID_STATUSES = ("pending", "sent", "cancelled")

    def __init__(
        self,
        repository: Optional[ReminderRepository] = None,
        team_repository: Optional[TeamRepository] = None,
    ):
        self.repository = repository or ReminderRepository()
        self.team_repository = team_repository or TeamRepository()

    def create_reminder(
        self,
        title: str,
        remind_at: str,
        assigned_to: Optional[int] = None,
    ) -> Reminder:
        if not title.strip():
            raise ValueError("Reminder title is required")
        if not remind_at.strip():
            raise ValueError("Reminder date and time is required")
        if assigned_to is not None and not self.team_repository.find_by_id(assigned_to):
            raise ValueError("Assigned team member not found")
        return self.repository.create_reminder(
            {
                "title": title.strip(),
                "remind_at": remind_at.strip(),
                "assigned_to": assigned_to,
            }
        )

    def list_reminders(self) -> list[Reminder]:
        return self.repository.find_all_with_assignee()

    def update_reminder(
        self,
        reminder_id: int,
        title: Optional[str] = None,
        remind_at: Optional[str] = None,
        assigned_to: Optional[int] = None,
        status: Optional[str] = None,
        *,
        update_assignee: bool = False,
    ) -> Optional[Reminder]:
        if not self.repository.find_by_id(reminder_id):
            return None

        updates: dict = {}
        if title is not None:
            if not title.strip():
                raise ValueError("Reminder title is required")
            updates["title"] = title.strip()
        if remind_at is not None:
            if not remind_at.strip():
                raise ValueError("Reminder date and time is required")
            updates["remind_at"] = remind_at.strip()
        if update_assignee:
            if assigned_to is not None and not self.team_repository.find_by_id(assigned_to):
                raise ValueError("Assigned team member not found")
            updates["assigned_to"] = assigned_to
        if status is not None:
            if status not in self.VALID_STATUSES:
                raise ValueError(f"Invalid status. Must be one of: {self.VALID_STATUSES}")
            updates["status"] = status

        if not updates:
            raise ValueError("No fields to update")

        return self.repository.update_reminder(reminder_id, updates)

    def delete_reminder(self, reminder_id: int) -> bool:
        if not self.repository.find_by_id(reminder_id):
            return False
        return self.repository.delete(reminder_id)
