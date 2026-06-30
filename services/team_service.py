from typing import Optional

from models.team_member import TeamMember
from repositories.team_repository import TeamRepository


class TeamService:
    def __init__(self, repository: Optional[TeamRepository] = None):
        self.repository = repository or TeamRepository()

    def create_member(
        self,
        name: str,
        role: Optional[str] = None,
        email: Optional[str] = None,
    ) -> TeamMember:
        if not name.strip():
            raise ValueError("Member name is required")
        if email and self.repository.find_by_email(email.strip()):
            raise ValueError("A member with this email already exists")
        return self.repository.create_member(
            {
                "name": name.strip(),
                "role": role,
                "email": email.strip() if email else None,
            }
        )

    def list_members(self) -> list[TeamMember]:
        return self.repository.find_all()

    def update_member(
        self,
        member_id: int,
        name: Optional[str] = None,
        role: Optional[str] = None,
        email: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Optional[TeamMember]:
        member = self.repository.find_by_id(member_id)
        if not member:
            return None

        updates: dict = {}
        if name is not None:
            if not name.strip():
                raise ValueError("Member name is required")
            updates["name"] = name.strip()
        if role is not None:
            updates["role"] = role or None
        if email is not None:
            email_value = email.strip() if email else None
            if email_value:
                existing = self.repository.find_by_email(email_value)
                if existing and existing.id != member_id:
                    raise ValueError("A member with this email already exists")
            updates["email"] = email_value
        if status is not None:
            updates["status"] = status

        if not updates:
            raise ValueError("No fields to update")

        return self.repository.update_member(member_id, updates)

    def delete_member(self, member_id: int) -> bool:
        if not self.repository.find_by_id(member_id):
            return False
        return self.repository.delete(member_id)
