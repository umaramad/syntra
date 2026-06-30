from typing import Optional

from models.user_settings import UserSettings
from repositories.user_settings_repository import UserSettingsRepository
from utils.datetime_utils import utc_now_str

VALID_THEMES = ("light", "dark")
DEFAULT_THEME = "light"


class UserSettingsService:
    def __init__(self, repository: Optional[UserSettingsRepository] = None):
        self.repository = repository or UserSettingsRepository()

    def get_settings(self) -> UserSettings:
        settings = self.repository.get_settings()
        if settings:
            return settings
        return UserSettings(
            id=1,
            reminder_notifications_enabled=False,
            theme=DEFAULT_THEME,
            updated_at=None,
        )

    def update_settings(
        self,
        *,
        reminder_notifications_enabled: Optional[bool] = None,
        theme: Optional[str] = None,
    ) -> UserSettings:
        existing = self.get_settings()

        resolved_enabled = (
            reminder_notifications_enabled
            if reminder_notifications_enabled is not None
            else existing.reminder_notifications_enabled
        )
        resolved_theme = theme if theme is not None else existing.theme
        if resolved_theme not in VALID_THEMES:
            raise ValueError(f"Invalid theme. Must be one of: {VALID_THEMES}")

        return self.repository.upsert_settings(
            {
                "reminder_notifications_enabled": resolved_enabled,
                "theme": resolved_theme,
                "updated_at": utc_now_str(),
            }
        )
