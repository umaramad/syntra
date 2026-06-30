from typing import Any, Optional


class BaseMCPTool:
    tool_key: str = ""
    name: str = ""

    def execute(self, input_text: str, payload: Optional[dict[str, Any]] = None) -> Any:
        raise NotImplementedError
