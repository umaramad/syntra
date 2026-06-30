from typing import Any, Optional

from models.user_profile import UserProfile
from repositories.base_repository import BaseRepository

_PROFILE_ID = 1

_PROFILE_SELECT = """
    SELECT up.*, tm.name AS team_member_name
    FROM user_profile up
    LEFT JOIN team_members tm ON up.team_member_id = tm.id
"""


class UserProfileRepository(BaseRepository[UserProfile]):
    def __init__(self):
        super().__init__("user_profile", UserProfile)

    def get_profile(self) -> Optional[UserProfile]:
        from database.db import get_db

        with get_db() as conn:
            row = conn.execute(
                f"{_PROFILE_SELECT} WHERE up.id = ?",
                (_PROFILE_ID,),
            ).fetchone()
        return UserProfile.from_row(row) if row else None

    def upsert_profile(self, data: dict[str, Any]) -> UserProfile:
        from database.db import get_db

        existing = self.get_profile()
        with get_db() as conn:
            if existing:
                conn.execute(
                    """
                    UPDATE user_profile
                    SET display_name = ?, email = ?, role = ?, team_member_id = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        data["display_name"],
                        data.get("email"),
                        data.get("role"),
                        data.get("team_member_id"),
                        data["updated_at"],
                        _PROFILE_ID,
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO user_profile (id, display_name, email, role, team_member_id, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        _PROFILE_ID,
                        data["display_name"],
                        data.get("email"),
                        data.get("role"),
                        data.get("team_member_id"),
                        data["updated_at"],
                    ),
                )

        profile = self.get_profile()
        if not profile:
            raise RuntimeError("Failed to save user profile")
        return profile
