from typing import Any, Optional

from models.task_comment import TaskComment
from repositories.base_repository import BaseRepository

_COMMENT_SELECT = """
    SELECT tc.*, tm.name AS assignee_name
    FROM task_comments tc
    LEFT JOIN team_members tm ON tc.assigned_to = tm.id
"""


class TaskCommentRepository(BaseRepository[TaskComment]):
    def __init__(self):
        super().__init__("task_comments", TaskComment)

    def create_comment(self, data: dict[str, Any]) -> TaskComment:
        comment_id = self._insert(
            ("task_id", "comment", "author_name", "status", "assigned_to"),
            (
                data["task_id"],
                data["comment"],
                data["author_name"],
                data["status"],
                data["assigned_to"],
            ),
        )
        return self.find_by_id_with_details(comment_id)

    def find_by_id_with_details(self, comment_id: int) -> Optional[TaskComment]:
        from database.db import get_db

        with get_db() as conn:
            row = conn.execute(
                f"{_COMMENT_SELECT} WHERE tc.id = ?",
                (comment_id,),
            ).fetchone()
        return TaskComment.from_row(row) if row else None

    def find_by_task_id(self, task_id: int) -> list[TaskComment]:
        from database.db import get_db

        with get_db() as conn:
            rows = conn.execute(
                f"""
                {_COMMENT_SELECT}
                WHERE tc.task_id = ?
                ORDER BY tc.created_at ASC, tc.id ASC
                """,
                (task_id,),
            ).fetchall()
        return [TaskComment.from_row(row) for row in rows]

    def count_by_task_id(self, task_id: int) -> int:
        from database.db import get_db

        with get_db() as conn:
            row = conn.execute(
                f"SELECT COUNT(*) AS total FROM {self.table_name} WHERE task_id = ?",
                (task_id,),
            ).fetchone()
        return int(row["total"]) if row else 0

    def delete_comment(self, comment_id: int, task_id: int) -> bool:
        from database.db import get_db

        with get_db() as conn:
            cursor = conn.execute(
                f"DELETE FROM {self.table_name} WHERE id = ? AND task_id = ?",
                (comment_id, task_id),
            )
        return cursor.rowcount > 0

    def update_comment(
        self, comment_id: int, task_id: int, data: dict[str, Any]
    ) -> Optional[TaskComment]:
        from database.db import get_db

        with get_db() as conn:
            cursor = conn.execute(
                """
                UPDATE task_comments
                SET comment = ?, status = ?, assigned_to = ?
                WHERE id = ? AND task_id = ?
                """,
                (
                    data["comment"],
                    data["status"],
                    data["assigned_to"],
                    comment_id,
                    task_id,
                ),
            )
            if cursor.rowcount == 0:
                return None
        return self.find_by_id_with_details(comment_id)
