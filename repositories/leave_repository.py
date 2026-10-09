from typing import Any, Optional

from database.db import get_db
from models.leave_plan import LeavePlan
from repositories.base_repository import BaseRepository

_LEAVE_SELECT = """
    SELECT lp.*, tm.name AS member_name
    FROM leave_plans lp
    LEFT JOIN team_members tm ON lp.team_member_id = tm.id
"""

_ALLOWED_FIELDS = ("team_member_id", "start_date", "end_date", "details")


class LeaveRepository(BaseRepository[LeavePlan]):
    def __init__(self):
        super().__init__("leave_plans", LeavePlan)

    def create_plan(self, data: dict[str, Any]) -> LeavePlan:
        plan_id = self._insert(
            ("team_member_id", "start_date", "end_date", "details"),
            (
                data["team_member_id"],
                data["start_date"],
                data["end_date"],
                data.get("details"),
            ),
        )
        return self.find_by_id(plan_id)

    def find_all(self, member_id: Optional[int] = None) -> list[LeavePlan]:
        sql = _LEAVE_SELECT
        params: tuple = ()
        if member_id is not None:
            sql += " WHERE lp.team_member_id = ?"
            params = (member_id,)
        sql += " ORDER BY lp.start_date DESC, lp.id DESC"
        with get_db() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [LeavePlan.from_row(row) for row in rows]

    def find_by_id(self, plan_id: int) -> Optional[LeavePlan]:
        with get_db() as conn:
            row = conn.execute(
                f"{_LEAVE_SELECT} WHERE lp.id = ?",
                (plan_id,),
            ).fetchone()
        return LeavePlan.from_row(row) if row else None

    def update_plan(self, plan_id: int, fields: dict[str, Any]) -> Optional[LeavePlan]:
        allowed = {key: fields[key] for key in _ALLOWED_FIELDS if key in fields}
        if allowed:
            assignments = ", ".join(f"{key} = ?" for key in allowed)
            values = (*allowed.values(), plan_id)
            with get_db() as conn:
                conn.execute(
                    f"UPDATE {self.table_name} SET {assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    values,
                )
        return self.find_by_id(plan_id)
