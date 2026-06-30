from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class Reminder:
    id: Optional[int]
    title: str
    remind_at: str
    assigned_to: Optional[int]
    status: str
    created_at: Optional[str]
    assignee_name: Optional[str] = None

    @classmethod
    def from_row(cls, row: Any) -> "Reminder":
        keys = row.keys()
        return cls(
            id=row["id"],
            title=row["title"],
            remind_at=row["remind_at"],
            assigned_to=row["assigned_to"],
            status=row["status"],
            created_at=row["created_at"],
            assignee_name=row["assignee_name"] if "assignee_name" in keys else None,
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "remind_at": self.remind_at,
            "assigned_to": self.assigned_to,
            "assignee_name": self.assignee_name,
            "status": self.status,
            "created_at": self.created_at,
        }
