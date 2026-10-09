import re
from datetime import datetime
from typing import Optional

from models.leave_plan import LeavePlan
from repositories.leave_repository import LeaveRepository
from repositories.team_repository import TeamRepository

MAX_DETAILS_LENGTH = 500
_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DATE_FORMAT = "%Y-%m-%d"


class LeaveService:
    def __init__(
        self,
        repository: Optional[LeaveRepository] = None,
        team_repository: Optional[TeamRepository] = None,
    ):
        self.repository = repository or LeaveRepository()
        self.team_repository = team_repository or TeamRepository()

    def list_plans(self, member_id: Optional[int] = None) -> list[LeavePlan]:
        # Filtering is by id only: a nonexistent member simply has no plans.
        if member_id is None:
            return self.repository.find_all()
        return self.repository.find_all(member_id=member_id)

    def create_plan(
        self,
        team_member_id,
        start_date,
        end_date,
        details: Optional[str] = None,
    ) -> LeavePlan:
        member_id = self._validate_member(team_member_id)
        start = self._validate_date(start_date, "Start date")
        end = self._validate_date(end_date, "End date")
        self._validate_range(start, end)

        return self.repository.create_plan(
            {
                "team_member_id": member_id,
                "start_date": start,
                "end_date": end,
                "details": self._validate_details(details),
            }
        )

    def update_plan(self, plan_id: int, data: dict) -> Optional[LeavePlan]:
        plan = self.repository.find_by_id(plan_id)
        if not plan:
            return None

        updates: dict = {}
        if "team_member_id" in data:
            updates["team_member_id"] = self._validate_member(data["team_member_id"])
        if "start_date" in data:
            updates["start_date"] = self._validate_date(data["start_date"], "Start date")
        if "end_date" in data:
            updates["end_date"] = self._validate_date(data["end_date"], "End date")
        if "details" in data:
            updates["details"] = self._validate_details(data["details"])

        if not updates:
            raise ValueError("No fields to update")

        start = updates.get("start_date", plan.start_date)
        end = updates.get("end_date", plan.end_date)
        self._validate_range(start, end)

        return self.repository.update_plan(plan_id, updates)

    def delete_plan(self, plan_id: int) -> bool:
        if not self.repository.find_by_id(plan_id):
            return False
        return self.repository.delete(plan_id)

    def _validate_member(self, member_id) -> int:
        if member_id in (None, ""):
            raise ValueError("Team member is required")
        try:
            member_id = int(member_id)
        except (TypeError, ValueError):
            raise ValueError("Team member is required")
        if not self.team_repository.find_by_id(member_id):
            raise ValueError("Team member not found")
        return member_id

    def _validate_date(self, value, label: str) -> str:
        if value in (None, ""):
            raise ValueError(f"{label} is required")
        if not isinstance(value, str) or not _DATE_PATTERN.match(value):
            raise ValueError(f"{label} must be in YYYY-MM-DD format")
        try:
            datetime.strptime(value, _DATE_FORMAT)
        except ValueError:
            raise ValueError(f"{label} is not a valid date")
        return value

    def _validate_range(self, start: str, end: str) -> None:
        if start > end:
            raise ValueError("End date must be on or after the start date")

    def _validate_details(self, details: Optional[str]) -> Optional[str]:
        if details is None:
            return None
        if not isinstance(details, str):
            raise ValueError("Details must be text")
        cleaned = details.strip()
        if not cleaned:
            return None
        if len(cleaned) > MAX_DETAILS_LENGTH:
            raise ValueError(
                f"Details must be {MAX_DETAILS_LENGTH} characters or fewer"
            )
        return cleaned
