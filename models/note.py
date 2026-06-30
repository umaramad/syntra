from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class Note:
    id: Optional[int]
    title: str
    content: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]

    @classmethod
    def from_row(cls, row: Any) -> "Note":
        return cls(
            id=row["id"],
            title=row["title"],
            content=row["content"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
