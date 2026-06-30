from typing import Any, Optional

from models.user_settings import UserSettings
from repositories.base_repository import BaseRepository

_SETTINGS_ID = 1


class UserSettingsRepository(BaseRepository[UserSettings]):
    def __init__(self):
        super().__init__("user_settings", UserSettings)

    def get_settings(self) -> Optional[UserSettings]:
        from database.db import get_db

        with get_db() as conn:
            row = conn.execute(
                f"SELECT * FROM {self.table_name} WHERE id = ?",
                (_SETTINGS_ID,),
            ).fetchone()
        return UserSettings.from_row(row) if row else None

    def upsert_settings(self, data: dict[str, Any]) -> UserSettings:
        from database.db import get_db

        existing = self.get_settings()
        enabled = 1 if data["reminder_notifications_enabled"] else 0
        theme = data["theme"]

        with get_db() as conn:
            if existing:
                conn.execute(
                    """
                    UPDATE user_settings
                    SET reminder_notifications_enabled = ?, theme = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (enabled, theme, data["updated_at"], _SETTINGS_ID),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO user_settings (id, reminder_notifications_enabled, theme, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (_SETTINGS_ID, enabled, theme, data["updated_at"]),
                )

        settings = self.get_settings()
        if not settings:
            raise RuntimeError("Failed to save user settings")
        return settings
