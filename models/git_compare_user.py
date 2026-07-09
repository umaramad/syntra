from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class GitCompareUser:
    id: Optional[int]
    user_id: str
    provider: str
    last_login_at: Optional[str]
    created_at: Optional[str]

    @classmethod
    def from_row(cls, row: Any) -> "GitCompareUser":
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            provider=row["provider"],
            last_login_at=row["last_login_at"],
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "provider": self.provider,
            "last_login_at": self.last_login_at,
            "created_at": self.created_at,
        }
