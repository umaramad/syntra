from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class TaskComment:
    id: Optional[int]
    task_id: int
    comment: str
    author_name: str
    created_at: Optional[str]

    @classmethod
    def from_row(cls, row: Any) -> "TaskComment":
        return cls(
            id=row["id"],
            task_id=row["task_id"],
            comment=row["comment"],
            author_name=row["author_name"],
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "comment": self.comment,
            "author_name": self.author_name,
            "created_at": self.created_at,
        }
