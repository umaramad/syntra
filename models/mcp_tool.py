from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class MCPTool:
    id: Optional[int]
    name: str
    tool_key: str
    description: Optional[str]
    keywords: Optional[str]
    patterns: Optional[str]
    enabled: bool
    created_at: Optional[str]

    @classmethod
    def from_row(cls, row: Any) -> "MCPTool":
        return cls(
            id=row["id"],
            name=row["name"],
            tool_key=row["tool_key"],
            description=row["description"],
            keywords=row["keywords"],
            patterns=row["patterns"],
            enabled=bool(row["enabled"]),
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "tool_key": self.tool_key,
            "description": self.description,
            "keywords": self.keywords,
            "patterns": self.patterns,
            "enabled": self.enabled,
            "created_at": self.created_at,
        }
