from typing import Any, Generic, Optional, TypeVar

from database.db import get_db

T = TypeVar("T")


class BaseRepository(Generic[T]):
    def __init__(self, table_name: str, model_class: type):
        self.table_name = table_name
        self.model_class = model_class

    def find_all(self) -> list[T]:
        with get_db() as conn:
            rows = conn.execute(
                f"SELECT * FROM {self.table_name} ORDER BY id",
            ).fetchall()
        return [self.model_class.from_row(row) for row in rows]

    def find_by_id(self, entity_id: int) -> Optional[T]:
        with get_db() as conn:
            row = conn.execute(
                f"SELECT * FROM {self.table_name} WHERE id = ?",
                (entity_id,),
            ).fetchone()
        return self.model_class.from_row(row) if row else None

    def delete(self, entity_id: int) -> bool:
        with get_db() as conn:
            cursor = conn.execute(
                f"DELETE FROM {self.table_name} WHERE id = ?",
                (entity_id,),
            )
        return cursor.rowcount > 0

    def _insert(self, columns: list[str], values: tuple[Any, ...]) -> int:
        placeholders = ", ".join("?" for _ in columns)
        col_names = ", ".join(columns)
        with get_db() as conn:
            cursor = conn.execute(
                f"INSERT INTO {self.table_name} ({col_names}) VALUES ({placeholders})",
                values,
            )
            return cursor.lastrowid

    def _update(self, entity_id: int, fields: dict[str, Any]) -> bool:
        if not fields:
            return False
        assignments = ", ".join(f"{key} = ?" for key in fields)
        values = (*fields.values(), entity_id)
        with get_db() as conn:
            cursor = conn.execute(
                f"UPDATE {self.table_name} SET {assignments} WHERE id = ?",
                values,
            )
        return cursor.rowcount > 0
