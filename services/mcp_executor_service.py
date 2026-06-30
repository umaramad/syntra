import json
from typing import Any, Optional

from mcp.registry import MCPRegistry
from repositories.mcp_tool_repository import MCPToolRepository
from services.tool_matcher_service import ToolMatcherService


class MCPExecutorService:
    def __init__(
        self,
        registry: Optional[MCPRegistry] = None,
        matcher: Optional[ToolMatcherService] = None,
        tool_repository: Optional[MCPToolRepository] = None,
    ):
        self.registry = registry or MCPRegistry()
        self.matcher = matcher or ToolMatcherService()
        self.tool_repository = tool_repository or MCPToolRepository()

    def execute(self, user_text: str) -> dict:
        """Match user input to a tool, execute it, and log the result."""
        text = user_text.strip()
        if not text:
            match_result = {
                "no_match": True,
                "confidence": 0,
                "reason": "Input text is empty",
            }
            response = {
                "success": False,
                "message": "No suitable tool found",
                "match": match_result,
            }
            self._log_execution(text, None, 0, response)
            return response

        enabled_tools = self.tool_repository.find_enabled_tools()
        match_result = self.matcher.match(text, enabled_tools)

        if match_result.get("no_match"):
            response = {
                "success": False,
                "message": "No suitable tool found",
                "match": match_result,
            }
            self._log_execution(
                text,
                None,
                match_result.get("confidence"),
                response,
            )
            return response

        tool_key = match_result["tool_key"]
        confidence = match_result["confidence"]
        tool = self.registry.get_tool(tool_key)

        if not tool:
            response = {
                "success": False,
                "message": "No suitable tool found",
                "match": match_result,
            }
            self._log_execution(text, tool_key, confidence, response)
            return response

        try:
            payload = self.matcher.extract_args(text, tool_key, enabled_tools)
            data = tool.execute(text, payload=payload)
            response = {
                "success": True,
                "message": f"Executed {match_result['tool_name']}",
                "match": match_result,
                "data": data,
            }
            self._log_execution(text, tool_key, confidence, response)
            return response
        except Exception as exc:
            response = {
                "success": False,
                "message": str(exc),
                "match": match_result,
            }
            self._log_execution(text, tool_key, confidence, response)
            return response

    def execute_direct(
        self,
        tool_key: str,
        payload: Optional[dict[str, Any]] = None,
        input_text: str = "",
    ) -> dict:
        """Execute a specific tool by key without matching."""
        tool = self.registry.get_tool(tool_key)
        if not tool:
            return {
                "success": False,
                "message": f"Unknown tool: {tool_key}",
            }

        try:
            data = tool.execute(input_text, payload=payload or {})
            response = {
                "success": True,
                "message": f"Executed {tool.name}",
                "data": data,
            }
            self._log_execution(input_text or None, tool_key, 100.0, response)
            return response
        except Exception as exc:
            response = {
                "success": False,
                "message": str(exc),
            }
            self._log_execution(input_text or None, tool_key, 100.0, response)
            return response

    def list_tools(self) -> list[dict]:
        return [
            {
                "tool_key": tool.tool_key,
                "name": tool.name,
                "description": getattr(tool, "description", ""),
                "inputSchema": getattr(tool, "input_schema", {}),
            }
            for tool in self.registry.list_tools()
        ]

    def handle_execute(self, data: dict[str, Any]) -> dict:
        query = (data.get("query") or "").strip()
        if query:
            return self.execute(query)

        tool_key = data.get("tool")
        if not tool_key:
            return {"success": False, "message": "tool or query is required"}

        return self.execute_direct(
            tool_key,
            payload=data.get("arguments"),
            input_text=data.get("input_text", ""),
        )

    def _log_execution(
        self,
        input_text: Optional[str],
        matched_tool_key: Optional[str],
        confidence: Optional[float],
        result: dict,
    ) -> None:
        self.tool_repository.log_execution(
            input_text=input_text,
            matched_tool_key=matched_tool_key,
            confidence=confidence,
            result=json.dumps(result),
        )
