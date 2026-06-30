from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class TeamMember:
    id: Optional[int]
    name: str
    role: Optional[str]
    email: Optional[str]
    status: str
    created_at: Optional[str]

    @classmethod
    def from_row(cls, row: Any) -> "TeamMember":
        return cls(
            id=row["id"],
            name=row["name"],
            role=row["role"],
            email=row["email"],
            status=row["status"],
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "email": self.email,
            "status": self.status,
            "created_at": self.created_at,
        }
