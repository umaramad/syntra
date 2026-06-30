from typing import Optional

from models.task import Task
from repositories.task_repository import TaskRepository
from repositories.team_repository import TeamRepository
from services.task_group_service import TaskGroupService


class TaskService:
    VALID_PRIORITIES = ("low", "medium", "high", "urgent")
    VALID_STATUSES = ("pending", "in_progress", "done", "cancelled")
    DEFAULT_GROUP_NAME = "General"

    def __init__(
        self,
        repository: Optional[TaskRepository] = None,
        group_service: Optional[TaskGroupService] = None,
        team_repository: Optional[TeamRepository] = None,
    ):
        self.repository = repository or TaskRepository()
        self.group_service = group_service or TaskGroupService()
        self.team_repository = team_repository or TeamRepository()

    def _resolve_group_id(
        self,
        group_id: Optional[int] = None,
        group_name: Optional[str] = None,
    ) -> int:
        if group_id is not None:
            group = self.group_service.get_group(group_id)
            if not group:
                raise ValueError("Task group not found")
            if group.archived:
                raise ValueError("Cannot use an archived task group")
            return group.id

        name = (group_name or self.DEFAULT_GROUP_NAME).strip()
        return self.group_service.get_or_create_group(name).id

    def _validate_assignee(self, assigned_to: Optional[int]) -> None:
        if assigned_to is not None and not self.team_repository.find_by_id(assigned_to):
            raise ValueError("Assigned team member not found")

    def create_task(
        self,
        title: str,
        description: Optional[str] = None,
        priority: str = "medium",
        due_date: Optional[str] = None,
        group_id: Optional[int] = None,
        group_name: Optional[str] = None,
        assigned_to: Optional[int] = None,
    ) -> Task:
        if not title.strip():
            raise ValueError("Task title is required")
        if priority not in self.VALID_PRIORITIES:
            raise ValueError(f"Invalid priority. Must be one of: {self.VALID_PRIORITIES}")

        resolved_group_id = self._resolve_group_id(group_id=group_id, group_name=group_name)
        self._validate_assignee(assigned_to)

        return self.repository.create_task(
            {
                "title": title.strip(),
                "description": description,
                "priority": priority,
                "due_date": due_date,
                "group_id": resolved_group_id,
                "assigned_to": assigned_to,
            }
        )

    def list_tasks(self, status: Optional[str] = None) -> list[Task]:
        if status:
            return self.repository.find_by_status_with_details(status)
        return self.repository.find_all_with_details()

    def recent_tasks(self, limit: int = 20) -> list[Task]:
        return self.repository.find_recent(limit)

    def mark_done(self, task_id: int) -> Optional[Task]:
        if not self.repository.find_by_id(task_id):
            return None
        return self.repository.update_status(task_id, "done")

    def update_task(
        self,
        task_id: int,
        title: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        due_date: Optional[str] = None,
        group_id: Optional[int] = None,
        group_name: Optional[str] = None,
        assigned_to: Optional[int] = None,
        *,
        update_assignee: bool = False,
    ) -> Optional[Task]:
        if not self.repository.find_by_id(task_id):
            return None

        updates: dict = {}
        if title is not None:
            if not title.strip():
                raise ValueError("Task title is required")
            updates["title"] = title.strip()
        if description is not None:
            updates["description"] = description
        if status is not None:
            if status not in self.VALID_STATUSES:
                raise ValueError(f"Invalid status. Must be one of: {self.VALID_STATUSES}")
            updates["status"] = status
        if priority is not None:
            if priority not in self.VALID_PRIORITIES:
                raise ValueError(f"Invalid priority. Must be one of: {self.VALID_PRIORITIES}")
            updates["priority"] = priority
        if due_date is not None:
            updates["due_date"] = due_date or None
        if group_id is not None or group_name is not None:
            updates["group_id"] = self._resolve_group_id(group_id=group_id, group_name=group_name)
        if update_assignee:
            self._validate_assignee(assigned_to)
            updates["assigned_to"] = assigned_to

        if not updates:
            raise ValueError("No fields to update")

        return self.repository.update_task(task_id, updates)

    def delete_task(self, task_id: int) -> bool:
        if not self.repository.find_by_id(task_id):
            return False
        return self.repository.delete(task_id)
