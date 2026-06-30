from datetime import datetime, timezone
from typing import Any, Optional

from models.note import Note
from repositories.base_repository import BaseRepository


class NoteRepository(BaseRepository[Note]):
    def __init__(self):
        super().__init__("notes", Note)

    def create_note(self, data: dict[str, Any]) -> Note:
        note_id = self._insert(
            ("title", "content"),
            (data["title"], data.get("content")),
        )
        return self.find_by_id(note_id)

    def find_recent(self, limit: int = 20) -> list[Note]:
        from database.db import get_db

        with get_db() as conn:
            rows = conn.execute(
                f"SELECT * FROM {self.table_name} ORDER BY created_at DESC, id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [Note.from_row(row) for row in rows]

    def update_note(self, note_id: int, data: dict[str, Any]) -> Optional[Note]:
        fields = {}
        if "title" in data:
            fields["title"] = data["title"]
        if "content" in data:
            fields["content"] = data["content"]
        if fields:
            fields["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            self._update(note_id, fields)
        return self.find_by_id(note_id)
