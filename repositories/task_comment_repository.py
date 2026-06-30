from typing import Optional

from models.task_comment import TaskComment
from repositories.base_repository import BaseRepository


class TaskCommentRepository(BaseRepository[TaskComment]):
    def __init__(self):
        super().__init__("task_comments", TaskComment)

    def create_comment(self, task_id: int, comment: str, author_name: str = "User") -> TaskComment:
        comment_id = self._insert(
            ("task_id", "comment", "author_name"),
            (task_id, comment, author_name),
        )
        return self.find_by_id(comment_id)

    def find_by_task_id(self, task_id: int) -> list[TaskComment]:
        from database.db import get_db

        with get_db() as conn:
            rows = conn.execute(
                f"""
                SELECT * FROM {self.table_name}
                WHERE task_id = ?
                ORDER BY created_at ASC, id ASC
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
