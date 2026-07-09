from typing import Optional

from database.db import get_db
from models.git_compare_user import GitCompareUser
from repositories.base_repository import BaseRepository


class GitCompareUserRepository(BaseRepository[GitCompareUser]):
    def __init__(self):
        super().__init__("git_compare_users", GitCompareUser)

    def find_by_user_id(self, user_id: str) -> Optional[GitCompareUser]:
        with get_db() as conn:
            row = conn.execute(
                f"SELECT * FROM {self.table_name} WHERE user_id = ?",
                (user_id,),
            ).fetchone()
        return GitCompareUser.from_row(row) if row else None

    def upsert_login(self, user_id: str, provider: str) -> GitCompareUser:
        existing = self.find_by_user_id(user_id)
        if existing:
            with get_db() as conn:
                conn.execute(
                    f"""
                    UPDATE {self.table_name}
                    SET provider = ?, last_login_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (provider, existing.id),
                )
            return self.find_by_id(existing.id)

        new_id = self._insert(
            ("user_id", "provider"),
            (user_id, provider),
        )
        return self.find_by_id(new_id)
