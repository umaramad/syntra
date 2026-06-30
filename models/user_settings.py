from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class UserSettings:
    id: int
    reminder_notifications_enabled: bool
    reminder_sound_enabled: bool
    theme: str
    updated_at: Optional[str] = None

    @classmethod
    def from_row(cls, row: Any) -> "UserSettings":
        keys = row.keys()
        theme = row["theme"] if "theme" in keys and row["theme"] else "light"
        sound_enabled = (
            bool(row["reminder_sound_enabled"])
            if "reminder_sound_enabled" in keys
            else False
        )
        return cls(
            id=row["id"],
            reminder_notifications_enabled=bool(row["reminder_notifications_enabled"]),
            reminder_sound_enabled=sound_enabled,
            theme=theme,
            updated_at=row["updated_at"],
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "reminder_notifications_enabled": self.reminder_notifications_enabled,
            "reminder_sound_enabled": self.reminder_sound_enabled,
            "theme": self.theme,
            "updated_at": self.updated_at,
        }
