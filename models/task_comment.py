from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class TaskComment:
    id: Optional[int]
    task_id: int
    comment: str
    author_name: str
    status: str
    assigned_to: Optional[int]
    assignee_name: Optional[str] = None
    created_at: Optional[str] = None

    @classmethod
    def from_row(cls, row: Any) -> "TaskComment":
        keys = row.keys()
        return cls(
            id=row["id"],
            task_id=row["task_id"],
            comment=row["comment"],
            author_name=row["author_name"],
            status=row["status"] if "status" in keys and row["status"] else "in_progress",
            assigned_to=row["assigned_to"] if "assigned_to" in keys else None,
            assignee_name=row["assignee_name"] if "assignee_name" in keys else None,
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "comment": self.comment,
            "author_name": self.author_name,
            "status": self.status,
            "assigned_to": self.assigned_to,
            "assignee_name": self.assignee_name,
            "created_at": self.created_at,
        }
