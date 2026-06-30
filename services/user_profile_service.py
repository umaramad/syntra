from typing import Optional

from models.user_profile import UserProfile
from repositories.team_repository import TeamRepository
from repositories.user_profile_repository import UserProfileRepository
from utils.datetime_utils import utc_now_str

DEFAULT_DISPLAY_NAME = "User"


class UserProfileService:
    def __init__(
        self,
        repository: Optional[UserProfileRepository] = None,
        team_repository: Optional[TeamRepository] = None,
    ):
        self.repository = repository or UserProfileRepository()
        self.team_repository = team_repository or TeamRepository()

    def get_profile(self) -> UserProfile:
        profile = self.repository.get_profile()
        if profile:
            return profile
        return UserProfile(
            id=1,
            display_name=DEFAULT_DISPLAY_NAME,
            email=None,
            role=None,
            team_member_id=None,
            team_member_name=None,
            updated_at=None,
        )

    def update_profile(
        self,
        display_name: str,
        email: Optional[str] = None,
        role: Optional[str] = None,
        team_member_id: Optional[int] = None,
        *,
        update_team_link: bool = False,
    ) -> UserProfile:
        name = display_name.strip()
        if not name:
            raise ValueError("Display name is required")

        resolved_team_member_id = team_member_id
        if update_team_link:
            if team_member_id is not None and not self.team_repository.find_by_id(team_member_id):
                raise ValueError("Linked team member not found")
        else:
            existing = self.repository.get_profile()
            resolved_team_member_id = existing.team_member_id if existing else None

        return self.repository.upsert_profile(
            {
                "display_name": name,
                "email": email.strip() if email else None,
                "role": role.strip() if role else None,
                "team_member_id": resolved_team_member_id,
                "updated_at": utc_now_str(),
            }
        )
