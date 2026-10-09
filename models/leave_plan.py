from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class LeavePlan:
    id: Optional[int]
    team_member_id: int
    start_date: str
    end_date: str
    details: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]
    member_name: Optional[str] = None

    @classmethod
    def from_row(cls, row: Any) -> "LeavePlan":
        keys = row.keys()
        return cls(
            id=row["id"],
            team_member_id=row["team_member_id"],
            start_date=row["start_date"],
            end_date=row["end_date"],
            details=row["details"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            member_name=row["member_name"] if "member_name" in keys else None,
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "team_member_id": self.team_member_id,
            "member_name": self.member_name,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "details": self.details,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
