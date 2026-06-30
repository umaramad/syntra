from typing import Optional

from models.note import Note
from repositories.note_repository import NoteRepository


class NoteService:
    def __init__(self, repository: Optional[NoteRepository] = None):
        self.repository = repository or NoteRepository()

    def create_note(self, title: str, content: Optional[str] = None) -> Note:
        if not title.strip():
            raise ValueError("Note title is required")
        return self.repository.create_note(
            {"title": title.strip(), "content": content},
        )

    def list_notes(self) -> list[Note]:
        return self.repository.find_all()

    def recent_notes(self, limit: int = 20) -> list[Note]:
        return self.repository.find_recent(limit)

    def update_note(
        self,
        note_id: int,
        title: Optional[str] = None,
        content: Optional[str] = None,
    ) -> Optional[Note]:
        if not self.repository.find_by_id(note_id):
            return None

        updates: dict = {}
        if title is not None:
            if not title.strip():
                raise ValueError("Note title is required")
            updates["title"] = title.strip()
        if content is not None:
            updates["content"] = content

        if not updates:
            raise ValueError("No fields to update")

        return self.repository.update_note(note_id, updates)

    def delete_note(self, note_id: int) -> bool:
        if not self.repository.find_by_id(note_id):
            return False
        return self.repository.delete(note_id)
