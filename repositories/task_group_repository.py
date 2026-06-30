from typing import Optional

from models.task_group import TaskGroup
from repositories.base_repository import BaseRepository


class TaskGroupRepository(BaseRepository[TaskGroup]):
    def __init__(self):
        super().__init__("task_groups", TaskGroup)

    def create_group(self, name: str) -> TaskGroup:
        group_id = self._insert(("name", "archived"), (name, 0))
        return self.find_by_id(group_id)

    def find_by_name(self, name: str, *, active_only: bool = False) -> Optional[TaskGroup]:
        from database.db import get_db

        query = f"SELECT * FROM {self.table_name} WHERE name = ?"
        params: tuple = (name,)
        if active_only:
            query += " AND archived = 0"

        with get_db() as conn:
            row = conn.execute(query, params).fetchone()
        return TaskGroup.from_row(row) if row else None

    def find_all_ordered(self, *, archived: bool = False) -> list[TaskGroup]:
        from database.db import get_db

        flag = 1 if archived else 0
        with get_db() as conn:
            rows = conn.execute(
                f"""
                SELECT * FROM {self.table_name}
                WHERE archived = ?
                ORDER BY name ASC, id ASC
                """,
                (flag,),
            ).fetchall()
        return [TaskGroup.from_row(row) for row in rows]

    def archive_group(self, group_id: int) -> bool:
        return self._update(group_id, {"archived": 1})

    def unarchive_group(self, group_id: int) -> bool:
        return self._update(group_id, {"archived": 0})
