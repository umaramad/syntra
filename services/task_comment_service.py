from typing import Optional

from models.task_comment import TaskComment
from repositories.task_comment_repository import TaskCommentRepository
from repositories.task_repository import TaskRepository
from repositories.team_repository import TeamRepository


class TaskCommentService:
    VALID_STATUSES = ("pending", "in_progress", "done", "cancelled")

    def __init__(
        self,
        repository: Optional[TaskCommentRepository] = None,
        task_repository: Optional[TaskRepository] = None,
        team_repository: Optional[TeamRepository] = None,
    ):
        self.repository = repository or TaskCommentRepository()
        self.task_repository = task_repository or TaskRepository()
        self.team_repository = team_repository or TeamRepository()

    def list_comments(self, task_id: int) -> Optional[list[TaskComment]]:
        if not self.task_repository.find_by_id(task_id):
            return None
        return self.repository.find_by_task_id(task_id)

    def add_comment(
        self,
        task_id: int,
        comment: str,
        author_name: str = "User",
        status: str = "in_progress",
        assigned_to: Optional[int] = None,
    ) -> Optional[TaskComment]:
        if not self.task_repository.find_by_id(task_id):
            return None
        if not comment.strip():
            raise ValueError("Comment text is required")
        if status not in self.VALID_STATUSES:
            raise ValueError(f"Invalid status. Must be one of: {self.VALID_STATUSES}")
        if assigned_to is None:
            raise ValueError("Team member is required")
        if not self.team_repository.find_by_id(assigned_to):
            raise ValueError("Assigned team member not found")

        return self.repository.create_comment(
            {
                "task_id": task_id,
                "comment": comment.strip(),
                "author_name": author_name.strip() or "User",
                "status": status,
                "assigned_to": assigned_to,
            }
        )

    def delete_comment(self, task_id: int, comment_id: int) -> bool:
        if not self.task_repository.find_by_id(task_id):
            return False
        return self.repository.delete_comment(comment_id, task_id)

    def update_comment(
        self,
        task_id: int,
        comment_id: int,
        comment: str,
        status: str,
        assigned_to: Optional[int] = None,
    ) -> Optional[TaskComment]:
        if not self.task_repository.find_by_id(task_id):
            return None
        if not comment.strip():
            raise ValueError("Comment text is required")
        if status not in self.VALID_STATUSES:
            raise ValueError(f"Invalid status. Must be one of: {self.VALID_STATUSES}")
        if assigned_to is None:
            raise ValueError("Team member is required")
        if not self.team_repository.find_by_id(assigned_to):
            raise ValueError("Assigned team member not found")

        return self.repository.update_comment(
            comment_id,
            task_id,
            {
                "comment": comment.strip(),
                "status": status,
                "assigned_to": assigned_to,
            },
        )
