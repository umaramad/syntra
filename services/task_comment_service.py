from typing import Optional

from models.task_comment import TaskComment
from repositories.task_comment_repository import TaskCommentRepository
from repositories.task_repository import TaskRepository


class TaskCommentService:
    def __init__(
        self,
        repository: Optional[TaskCommentRepository] = None,
        task_repository: Optional[TaskRepository] = None,
    ):
        self.repository = repository or TaskCommentRepository()
        self.task_repository = task_repository or TaskRepository()

    def list_comments(self, task_id: int) -> list[TaskComment]:
        if not self.task_repository.find_by_id(task_id):
            return None
        return self.repository.find_by_task_id(task_id)

    def add_comment(
        self,
        task_id: int,
        comment: str,
        author_name: str = "User",
    ) -> Optional[TaskComment]:
        if not self.task_repository.find_by_id(task_id):
            return None
        if not comment.strip():
            raise ValueError("Comment text is required")
        return self.repository.create_comment(
            task_id,
            comment.strip(),
            author_name.strip() or "User",
        )

    def delete_comment(self, task_id: int, comment_id: int) -> bool:
        if not self.task_repository.find_by_id(task_id):
            return False
        return self.repository.delete_comment(comment_id, task_id)
