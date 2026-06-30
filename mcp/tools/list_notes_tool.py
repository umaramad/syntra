from typing import Any, Optional

from mcp.tools.base_tool import BaseMCPTool
from services.note_service import NoteService


class ListNotesTool(BaseMCPTool):
    tool_key = "list_notes"
    name = "List Notes"
    description = "List recent notes."
    input_schema = {
        "type": "object",
        "properties": {
            "limit": {"type": "integer", "description": "Maximum number of notes to return"},
        },
    }

    def __init__(self, note_service: Optional[NoteService] = None):
        self.note_service = note_service or NoteService()

    def execute(self, input_text: str, payload: Optional[dict[str, Any]] = None) -> dict:
        data = payload or {}
        limit = int(data.get("limit", 20))
        notes = self.note_service.recent_notes(limit=limit)
        return {
            "count": len(notes),
            "notes": [note.to_dict() for note in notes],
        }
