import json
from typing import Any, Optional

from database.db import get_db
from models.git_compare_history import GitCompareHistory
from repositories.base_repository import BaseRepository


class GitCompareHistoryRepository(BaseRepository[GitCompareHistory]):
    def __init__(self):
        super().__init__("git_compare_history", GitCompareHistory)

    def create_entry(self, payload: dict[str, Any]) -> GitCompareHistory:
        entry_id = self._insert(
            (
                "user_id",
                "provider",
                "from_repo",
                "to_repo",
                "from_ref",
                "from_ref_type",
                "to_ref",
                "to_ref_type",
                "stats_json",
                "files_json",
            ),
            (
                payload["user_id"],
                payload["provider"],
                payload["from_repo"],
                payload["to_repo"],
                payload["from_ref"],
                payload["from_ref_type"],
                payload["to_ref"],
                payload["to_ref_type"],
                json.dumps(payload.get("stats") or {}),
                json.dumps(payload.get("files") or []),
            ),
        )
        return self.find_by_id(entry_id)

    def list_for_user(self, user_id: str, limit: int = 50) -> list[GitCompareHistory]:
        with get_db() as conn:
            rows = conn.execute(
                f"""
                SELECT * FROM {self.table_name}
                WHERE user_id = ?
                ORDER BY datetime(created_at) DESC, id DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
        return [GitCompareHistory.from_row(row) for row in rows]

    def find_for_user(self, entry_id: int, user_id: str) -> Optional[GitCompareHistory]:
        with get_db() as conn:
            row = conn.execute(
                f"SELECT * FROM {self.table_name} WHERE id = ? AND user_id = ?",
                (entry_id, user_id),
            ).fetchone()
        return GitCompareHistory.from_row(row) if row else None
