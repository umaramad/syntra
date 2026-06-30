from typing import Any, Optional

from models.task_group import TaskGroup
from repositories.task_group_repository import TaskGroupRepository
from repositories.task_repository import TaskRepository


class TaskGroupService:
    def __init__(
        self,
        repository: Optional[TaskGroupRepository] = None,
        task_repository: Optional[TaskRepository] = None,
    ):
        self.repository = repository or TaskGroupRepository()
        self.task_repository = task_repository or TaskRepository()

    def create_group(self, name: str) -> TaskGroup:
        if not name.strip():
            raise ValueError("Group name is required")
        normalized = name.strip()
        existing = self.repository.find_by_name(normalized, active_only=True)
        if existing:
            raise ValueError("A group with this name already exists")
        return self.repository.create_group(normalized)

    def list_groups(self) -> list[TaskGroup]:
        return self.repository.find_all_ordered(archived=False)

    def list_archived_groups_with_tasks(self) -> list[dict[str, Any]]:
        groups = self.repository.find_all_ordered(archived=True)
        result: list[dict[str, Any]] = []
        for group in groups:
            payload = group.to_dict()
            tasks = self.task_repository.find_by_group_id_with_details(group.id)
            payload["tasks"] = [task.to_dict() for task in tasks]
            payload["task_count"] = len(tasks)
            result.append(payload)
        return result

    def get_or_create_group(self, name: str) -> TaskGroup:
        normalized = name.strip()
        if not normalized:
            raise ValueError("Group name is required")
        existing = self.repository.find_by_name(normalized, active_only=True)
        if existing:
            return existing
        return self.repository.create_group(normalized)

    def get_group(self, group_id: int) -> Optional[TaskGroup]:
        return self.repository.find_by_id(group_id)

    def archive_group(self, group_id: int) -> TaskGroup:
        group = self.repository.find_by_id(group_id)
        if not group:
            raise ValueError("Task group not found")
        if group.archived:
            raise ValueError("Task group is already archived")

        self.repository.archive_group(group_id)
        archived = self.repository.find_by_id(group_id)
        if not archived:
            raise ValueError("Task group not found")
        return archived

    def restore_group(self, group_id: int) -> TaskGroup:
        group = self.repository.find_by_id(group_id)
        if not group:
            raise ValueError("Task group not found")
        if not group.archived:
            raise ValueError("Task group is not archived")

        conflict = self.repository.find_by_name(group.name, active_only=True)
        if conflict:
            raise ValueError(
                f'Cannot restore "{group.name}" because an active group with that name already exists'
            )

        self.repository.unarchive_group(group_id)
        restored = self.repository.find_by_id(group_id)
        if not restored:
            raise ValueError("Task group not found")
        return restored

    def delete_archived_group(self, group_id: int) -> bool:
        group = self.repository.find_by_id(group_id)
        if not group:
            raise ValueError("Task group not found")
        if not group.archived:
            raise ValueError("Only archived groups can be deleted from Archive")

        self.task_repository.delete_by_group_id(group_id)
        return self.repository.delete(group_id)
