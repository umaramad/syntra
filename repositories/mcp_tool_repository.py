from typing import Optional

from models.mcp_tool import MCPTool
from models.tool_execution_log import ToolExecutionLog
from repositories.base_repository import BaseRepository


class MCPToolRepository(BaseRepository[MCPTool]):
    LOG_TABLE = "tool_execution_logs"

    def __init__(self):
        super().__init__("mcp_tools", MCPTool)

    def find_enabled_tools(self) -> list[MCPTool]:
        from database.db import get_db

        with get_db() as conn:
            rows = conn.execute(
                f"SELECT * FROM {self.table_name} WHERE enabled = 1 ORDER BY name",
            ).fetchall()
        return [MCPTool.from_row(row) for row in rows]

    def log_execution(
        self,
        input_text: Optional[str],
        matched_tool_key: Optional[str],
        confidence: Optional[float],
        result: Optional[str],
    ) -> ToolExecutionLog:
        from database.db import get_db

        with get_db() as conn:
            cursor = conn.execute(
                f"""
                INSERT INTO {self.LOG_TABLE}
                    (input_text, matched_tool_key, confidence, result)
                VALUES (?, ?, ?, ?)
                """,
                (input_text, matched_tool_key, confidence, result),
            )
            log_id = cursor.lastrowid
            row = conn.execute(
                f"SELECT * FROM {self.LOG_TABLE} WHERE id = ?",
                (log_id,),
            ).fetchone()
        return ToolExecutionLog.from_row(row)
