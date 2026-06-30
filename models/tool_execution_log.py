from dataclasses import dataclass
from typing import Optional


@dataclass
class ToolExecutionLog:
    id: Optional[int]
    input_text: Optional[str]
    matched_tool_key: Optional[str]
    confidence: Optional[float]
    result: Optional[str]
    created_at: Optional[str] = None

    @classmethod
    def from_row(cls, row) -> "ToolExecutionLog":
        return cls(
            id=row["id"],
            input_text=row["input_text"],
            matched_tool_key=row["matched_tool_key"],
            confidence=row["confidence"],
            result=row["result"],
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "input_text": self.input_text,
            "matched_tool_key": self.matched_tool_key,
            "confidence": self.confidence,
            "result": self.result,
            "created_at": self.created_at,
        }
