from typing import Any, Optional

from models.reminder import Reminder
from repositories.base_repository import BaseRepository


class ReminderRepository(BaseRepository[Reminder]):
    def __init__(self):
        super().__init__("reminders", Reminder)

    def create_reminder(self, data: dict[str, Any]) -> Reminder:
        reminder_id = self._insert(
            ("title", "remind_at", "assigned_to", "status"),
            (
                data["title"],
                data["remind_at"],
                data.get("assigned_to"),
                data.get("status", "pending"),
            ),
        )
        return self.find_by_id_with_assignee(reminder_id)

    def find_by_id_with_assignee(self, reminder_id: int) -> Optional[Reminder]:
        from database.db import get_db

        with get_db() as conn:
            row = conn.execute(
                """
                SELECT r.*, tm.name AS assignee_name
                FROM reminders r
                LEFT JOIN team_members tm ON r.assigned_to = tm.id
                WHERE r.id = ?
                """,
                (reminder_id,),
            ).fetchone()
        return Reminder.from_row(row) if row else None

    def find_all_with_assignee(self) -> list[Reminder]:
        from database.db import get_db

        with get_db() as conn:
            rows = conn.execute(
                """
                SELECT r.*, tm.name AS assignee_name
                FROM reminders r
                LEFT JOIN team_members tm ON r.assigned_to = tm.id
                ORDER BY r.remind_at ASC, r.id ASC
                """
            ).fetchall()
        return [Reminder.from_row(row) for row in rows]

    def update_reminder(self, reminder_id: int, data: dict[str, Any]) -> Optional[Reminder]:
        allowed = ("title", "remind_at", "assigned_to", "status")
        fields = {key: data[key] for key in allowed if key in data}
        if fields:
            self._update(reminder_id, fields)
        return self.find_by_id_with_assignee(reminder_id)
