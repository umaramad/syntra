from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class Task:
    id: Optional[int]
    title: str
    description: Optional[str]
    status: str
    priority: str
    due_date: Optional[str]
    group_id: Optional[int]
    assigned_to: Optional[int]
    created_at: Optional[str]
    group_name: Optional[str] = None
    assignee_name: Optional[str] = None
    comment_count: int = 0

    @classmethod
    def from_row(cls, row: Any) -> "Task":
        keys = row.keys()
        return cls(
            id=row["id"],
            title=row["title"],
            description=row["description"],
            status=row["status"],
            priority=row["priority"],
            due_date=row["due_date"],
            group_id=row["group_id"],
            assigned_to=row["assigned_to"],
            created_at=row["created_at"],
            group_name=row["group_name"] if "group_name" in keys else None,
            assignee_name=row["assignee_name"] if "assignee_name" in keys else None,
            comment_count=int(row["comment_count"]) if "comment_count" in keys else 0,
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "priority": self.priority,
            "due_date": self.due_date,
            "group_id": self.group_id,
            "group_name": self.group_name,
            "assigned_to": self.assigned_to,
            "assignee_name": self.assignee_name,
            "created_at": self.created_at,
            "comment_count": self.comment_count,
        }
