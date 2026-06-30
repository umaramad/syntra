from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class UserProfile:
    id: int
    display_name: str
    email: Optional[str]
    role: Optional[str]
    team_member_id: Optional[int]
    team_member_name: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def from_row(cls, row: Any) -> "UserProfile":
        keys = row.keys()
        return cls(
            id=row["id"],
            display_name=row["display_name"],
            email=row["email"],
            role=row["role"],
            team_member_id=row["team_member_id"],
            team_member_name=row["team_member_name"] if "team_member_name" in keys else None,
            updated_at=row["updated_at"],
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "display_name": self.display_name,
            "email": self.email,
            "role": self.role,
            "team_member_id": self.team_member_id,
            "team_member_name": self.team_member_name,
            "updated_at": self.updated_at,
        }
