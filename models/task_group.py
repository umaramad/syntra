from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class TaskGroup:
    id: Optional[int]
    name: str
    created_at: Optional[str]
    archived: bool = False

    @classmethod
    def from_row(cls, row: Any) -> "TaskGroup":
        keys = row.keys()
        archived = bool(row["archived"]) if "archived" in keys else False
        return cls(
            id=row["id"],
            name=row["name"],
            created_at=row["created_at"],
            archived=archived,
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at,
            "archived": self.archived,
        }
