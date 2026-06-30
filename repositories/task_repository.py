from typing import Any, Optional

from models.task import Task
from repositories.base_repository import BaseRepository

_TASK_SELECT = """
    SELECT t.*,
           tg.name AS group_name,
           tm.name AS assignee_name,
           (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) AS comment_count
    FROM tasks t
    LEFT JOIN task_groups tg ON t.group_id = tg.id
    LEFT JOIN team_members tm ON t.assigned_to = tm.id
"""

_ACTIVE_GROUP_FILTER = " AND COALESCE(tg.archived, 0) = 0"


class TaskRepository(BaseRepository[Task]):
    def __init__(self):
        super().__init__("tasks", Task)

    def create_task(self, data: dict[str, Any]) -> Task:
        task_id = self._insert(
            (
                "title",
                "description",
                "status",
                "priority",
                "due_date",
                "group_id",
                "assigned_to",
            ),
            (
                data["title"],
                data.get("description"),
                data.get("status", "pending"),
                data.get("priority", "medium"),
                data.get("due_date"),
                data["group_id"],
                data.get("assigned_to"),
            ),
        )
        return self.find_by_id_with_details(task_id)

    def find_by_id_with_details(self, task_id: int) -> Optional[Task]:
        from database.db import get_db

        with get_db() as conn:
            row = conn.execute(
                f"{_TASK_SELECT} WHERE t.id = ?",
                (task_id,),
            ).fetchone()
        return Task.from_row(row) if row else None

    def find_all_with_details(self) -> list[Task]:
        from database.db import get_db

        with get_db() as conn:
            rows = conn.execute(
                f"{_TASK_SELECT} WHERE 1=1{_ACTIVE_GROUP_FILTER} ORDER BY tg.name ASC, t.created_at DESC, t.id DESC"
            ).fetchall()
        return [Task.from_row(row) for row in rows]

    def find_by_status_with_details(self, status: str) -> list[Task]:
        from database.db import get_db

        with get_db() as conn:
            rows = conn.execute(
                f"{_TASK_SELECT} WHERE t.status = ?{_ACTIVE_GROUP_FILTER} ORDER BY tg.name ASC, t.created_at DESC, t.id DESC",
                (status,),
            ).fetchall()
        return [Task.from_row(row) for row in rows]

    def update_status(self, task_id: int, status: str) -> Optional[Task]:
        self._update(task_id, {"status": status})
        return self.find_by_id_with_details(task_id)

    def find_recent(self, limit: int = 20) -> list[Task]:
        from database.db import get_db

        with get_db() as conn:
            rows = conn.execute(
                f"{_TASK_SELECT} WHERE 1=1{_ACTIVE_GROUP_FILTER} ORDER BY t.created_at DESC, t.id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [Task.from_row(row) for row in rows]

    def find_by_group_id_with_details(self, group_id: int) -> list[Task]:
        from database.db import get_db

        with get_db() as conn:
            rows = conn.execute(
                f"{_TASK_SELECT} WHERE t.group_id = ? ORDER BY t.created_at DESC, t.id DESC",
                (group_id,),
            ).fetchall()
        return [Task.from_row(row) for row in rows]

    def delete_by_group_id(self, group_id: int) -> int:
        from database.db import get_db

        with get_db() as conn:
            cursor = conn.execute(
                "DELETE FROM tasks WHERE group_id = ?",
                (group_id,),
            )
        return cursor.rowcount

    def update_task(self, task_id: int, data: dict[str, Any]) -> Optional[Task]:
        allowed = (
            "title",
            "description",
            "status",
            "priority",
            "due_date",
            "group_id",
            "assigned_to",
        )
        fields = {key: data[key] for key in allowed if key in data}
        if fields:
            self._update(task_id, fields)
        return self.find_by_id_with_details(task_id)

    def find_by_status(self, status: str) -> list[Task]:
        return self.find_by_status_with_details(status)
