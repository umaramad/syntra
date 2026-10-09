from typing import Any, Optional

from models.team_member import TeamMember
from repositories.base_repository import BaseRepository


class TeamRepository(BaseRepository[TeamMember]):
    def __init__(self):
        super().__init__("team_members", TeamMember)

    def create_member(self, data: dict[str, Any]) -> TeamMember:
        member_id = self._insert(
            ("name", "role", "email", "status"),
            (
                data["name"],
                data.get("role"),
                data.get("email"),
                data.get("status", "offline"),
            ),
        )
        return self.find_by_id(member_id)

    def delete(self, member_id: int) -> bool:
        """Delete a member, clearing every foreign key that points at them first.

        tasks.assigned_to, task_comments.assigned_to, reminders.assigned_to and
        user_profile.team_member_id all reference team_members(id) with no
        ON DELETE action, so leaving them set would make SQLite raise
        IntegrityError on the DELETE.
        """
        from database.db import get_db

        references = (
            ("tasks", "assigned_to"),
            ("task_comments", "assigned_to"),
            ("reminders", "assigned_to"),
            ("user_profile", "team_member_id"),
        )
        with get_db() as conn:
            for table, column in references:
                conn.execute(
                    f"UPDATE {table} SET {column} = NULL WHERE {column} = ?",
                    (member_id,),
                )
            cursor = conn.execute(
                f"DELETE FROM {self.table_name} WHERE id = ?",
                (member_id,),
            )
        return cursor.rowcount > 0

    def find_by_name_match(self, name: str) -> list[TeamMember]:
        needle = name.strip().lower()
        if not needle:
            return []

        members = self.find_all()
        exact = [member for member in members if (member.name or "").lower() == needle]
        if exact:
            return exact
        return [member for member in members if needle in (member.name or "").lower()]

    def find_by_email(self, email: str) -> Optional[TeamMember]:
        from database.db import get_db

        with get_db() as conn:
            row = conn.execute(
                f"SELECT * FROM {self.table_name} WHERE email = ?",
                (email,),
            ).fetchone()
        return TeamMember.from_row(row) if row else None

    def update_member(self, member_id: int, data: dict[str, Any]) -> Optional[TeamMember]:
        allowed = ("name", "role", "email", "status")
        fields = {key: data[key] for key in allowed if key in data}
        if fields:
            self._update(member_id, fields)
        return self.find_by_id(member_id)
