from typing import Any, Optional

from mcp.tools.base_tool import BaseMCPTool
from services.note_service import NoteService

NOTE_PREFIXES = (
    "create note",
    "add note",
    "new note",
    "write note",
)


def extract_note_fields(
    input_text: str,
    payload: Optional[dict[str, Any]] = None,
) -> tuple[str, str]:
    data = payload or {}
    if data.get("title"):
        return str(data["title"]).strip(), str(data.get("content", ""))

    text = input_text.strip()
    if not text:
        return "Untitled note", ""

    body = text
    lower = text.lower()
    for prefix in NOTE_PREFIXES:
        if lower.startswith(prefix):
            body = text[len(prefix) :].strip(" :-")
            break

    if body.lower().startswith("about "):
        return "Note", body[6:].strip()

    if " about " in body.lower():
        title_part, content_part = body.split(" about ", 1)
        title = title_part.strip(" :-") or "Untitled note"
        return title, content_part.strip()

    if ": " in body:
        title_part, content_part = body.split(": ", 1)
        title = title_part.strip(" :-") or "Untitled note"
        return title, content_part.strip()

    return body or "Untitled note", ""


class CreateNoteTool(BaseMCPTool):
    tool_key = "create_note"
    name = "Create Note"
    description = "Create a new note with a title and optional content."
    input_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Note title"},
            "content": {"type": "string", "description": "Note body"},
        },
    }

    def __init__(self, note_service: Optional[NoteService] = None):
        self.note_service = note_service or NoteService()

    def execute(self, input_text: str, payload: Optional[dict[str, Any]] = None) -> dict:
        title, content = extract_note_fields(input_text, payload)
        note = self.note_service.create_note(title=title, content=content)
        return note.to_dict()
