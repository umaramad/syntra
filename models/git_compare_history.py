import json
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class GitCompareHistory:
    id: Optional[int]
    user_id: str
    provider: str
    from_repo: str
    to_repo: str
    from_ref: str
    from_ref_type: str
    to_ref: str
    to_ref_type: str
    stats_json: Optional[str]
    files_json: Optional[str]
    created_at: Optional[str]

    @classmethod
    def from_row(cls, row: Any) -> "GitCompareHistory":
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            provider=row["provider"],
            from_repo=row["from_repo"],
            to_repo=row["to_repo"],
            from_ref=row["from_ref"],
            from_ref_type=row["from_ref_type"],
            to_ref=row["to_ref"],
            to_ref_type=row["to_ref_type"],
            stats_json=row["stats_json"],
            files_json=row["files_json"],
            created_at=row["created_at"],
        )

    def to_dict(self, *, include_files: bool = False) -> dict:
        stats = json.loads(self.stats_json) if self.stats_json else {}
        payload = {
            "id": self.id,
            "user_id": self.user_id,
            "provider": self.provider,
            "from_repo": self.from_repo,
            "to_repo": self.to_repo,
            "from_ref": self.from_ref,
            "from_ref_type": self.from_ref_type,
            "to_ref": self.to_ref,
            "to_ref_type": self.to_ref_type,
            "stats": stats,
            "created_at": self.created_at,
        }
        if include_files and self.files_json:
            payload["files"] = json.loads(self.files_json)
        return payload
