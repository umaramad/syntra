import re
import string
from typing import Optional

import config
from models.mcp_tool import MCPTool

SYNONYMS = {
    "todo": "task",
    "reminder": "task",
    "write": "note",
    "member": "team",
    "user": "team",
}


class ToolMatcherService:
    """Match user text to MCP tools using keyword, pattern, and token scoring."""

    WEIGHTS = {
        "keyword_score": 0.45,
        "pattern_score": 0.35,
        "token_score": 0.20,
    }

    def match(self, user_text: str, tools: list[MCPTool]) -> dict:
        normalized_text, input_tokens = self._normalize(user_text)
        if not normalized_text or not tools:
            return self._no_match(
                confidence=0,
                reason="No input text or no enabled tools available",
            )

        best_result = None
        best_confidence = -1.0

        for tool in tools:
            keyword_tokens = self._keyword_tokens(tool.keywords)
            patterns = self._split_csv(tool.patterns)

            keyword_score = self._keyword_score(input_tokens, keyword_tokens)
            pattern_score = self._pattern_score(normalized_text, patterns)
            if pattern_score >= 100:
                keyword_score = max(keyword_score, 70.0)
            token_score = self._token_score(input_tokens, keyword_tokens)

            confidence = round(
                keyword_score * self.WEIGHTS["keyword_score"]
                + pattern_score * self.WEIGHTS["pattern_score"]
                + token_score * self.WEIGHTS["token_score"],
                2,
            )

            scores = {
                "keyword_score": round(keyword_score, 2),
                "pattern_score": round(pattern_score, 2),
                "token_score": round(token_score, 2),
            }

            if confidence > best_confidence:
                best_confidence = confidence
                best_result = {
                    "tool_key": tool.tool_key,
                    "tool_name": tool.name,
                    "confidence": confidence,
                    "reason": self._build_reason(tool, scores, confidence),
                    "scores": scores,
                }

        if best_result is None or best_confidence < config.TOOL_MATCH_THRESHOLD:
            return self._no_match(
                confidence=best_confidence if best_confidence >= 0 else 0,
                reason=(
                    f"Best score {best_confidence:.0f} is below threshold "
                    f"{config.TOOL_MATCH_THRESHOLD}"
                    if best_result
                    else "No suitable tool match found"
                ),
                scores=best_result["scores"] if best_result else None,
            )

        return best_result

    def extract_args(self, query: str, tool_key: str, tools: list[MCPTool]) -> dict:
        tool = next((item for item in tools if item.tool_key == tool_key), None)
        patterns = self._split_csv(tool.patterns if tool else "")

        if tool_key == "create_task":
            title = self._after_pattern(query, patterns) or self._after_keywords(
                query, ("create", "add", "new", "task", "todo", "reminder")
            )
            return {"title": title or "Untitled task", "description": ""}

        if tool_key == "create_note":
            title = self._after_pattern(query, patterns) or self._after_keywords(
                query, ("create", "add", "new", "note", "write")
            )
            return {"title": title or "Untitled note", "content": ""}

        if tool_key == "assign_task":
            from services.task_service import TaskService

            normalized = query.lower()
            remainder = normalized
            for pattern in patterns:
                if pattern in normalized:
                    remainder = normalized.split(pattern, 1)[1]
                    break
            task_id = None
            assignee_id = None
            tokens = remainder.replace("to", " ").replace("#", " ").split()
            for token in tokens:
                if token.isdigit():
                    if task_id is None:
                        task_id = int(token)
                    elif assignee_id is None:
                        assignee_id = int(token)

            task_title, assignee_name = TaskService.parse_assign_input(query)
            return {
                "task_id": task_id,
                "assignee_id": assignee_id,
                "task_title": task_title,
                "assignee_name": assignee_name,
            }

        return {}

    def _normalize(self, text: str) -> tuple[str, set[str]]:
        lowered = text.strip().lower()
        cleaned = lowered.translate(str.maketrans("", "", string.punctuation))
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        tokens = {token for token in cleaned.split() if token}
        return cleaned, tokens

    def _split_csv(self, value: Optional[str]) -> list[str]:
        if not value:
            return []
        return [item.strip().lower() for item in value.split(",") if item.strip()]

    def _keyword_tokens(self, keywords: Optional[str]) -> set[str]:
        return set(self._split_csv(keywords))

    def _expand_token(self, token: str) -> set[str]:
        expanded = {token}
        if token in SYNONYMS:
            expanded.add(SYNONYMS[token])
        return expanded

    def _expand_tokens(self, tokens: set[str]) -> set[str]:
        expanded: set[str] = set()
        for token in tokens:
            expanded.update(self._expand_token(token))
        return expanded

    def _token_matches_keyword(self, token: str, keyword: str) -> bool:
        if self._expand_token(token) & self._expand_token(keyword):
            return True
        if len(token) >= 4 and (keyword.startswith(token) or token.startswith(keyword)):
            return True
        return False

    def _keyword_score(self, input_tokens: set[str], keyword_tokens: set[str]) -> float:
        if not input_tokens or not keyword_tokens:
            return 0.0

        matched = 0
        for token in input_tokens:
            if any(self._token_matches_keyword(token, keyword) for keyword in keyword_tokens):
                matched += 1
        return (matched / len(input_tokens)) * 100

    def _pattern_score(self, normalized_text: str, patterns: list[str]) -> float:
        if not normalized_text or not patterns:
            return 0.0

        input_tokens = normalized_text.split()
        for pattern in patterns:
            normalized_pattern = self._normalize(pattern)[0]
            if not normalized_pattern:
                continue
            if normalized_pattern in normalized_text:
                return 100.0
            pattern_tokens = normalized_pattern.split()
            if self._sequence_match(input_tokens, pattern_tokens):
                return 100.0
        return 0.0

    def _sequence_match(self, haystack: list[str], needle: list[str]) -> bool:
        if not needle:
            return False
        index = 0
        for token in haystack:
            if token == needle[index]:
                index += 1
                if index == len(needle):
                    return True
        return False

    def _token_score(self, input_tokens: set[str], keyword_tokens: set[str]) -> float:
        if not input_tokens or not keyword_tokens:
            return 0.0

        matched_input = {
            token
            for token in input_tokens
            if any(self._token_matches_keyword(token, keyword) for keyword in keyword_tokens)
        }
        expanded_input = self._expand_tokens(input_tokens)
        expanded_keywords = self._expand_tokens(keyword_tokens)
        overlap = matched_input | (expanded_input & expanded_keywords)
        union = expanded_input | expanded_keywords
        if not union:
            return 0.0
        return (len(overlap) / len(union)) * 100

    def _build_reason(self, tool: MCPTool, scores: dict[str, float], confidence: float) -> str:
        parts = []
        if scores["pattern_score"] > 0:
            parts.append("pattern match")
        if scores["keyword_score"] > 0:
            parts.append("keyword overlap")
        if scores["token_score"] > 0:
            parts.append("token overlap")
        detail = ", ".join(parts) if parts else "weak signals"
        return f"Selected '{tool.name}' ({tool.tool_key}) via {detail} with {confidence:.0f}% confidence"

    def _no_match(
        self,
        confidence: float,
        reason: str,
        scores: Optional[dict[str, float]] = None,
    ) -> dict:
        result = {
            "no_match": True,
            "confidence": round(max(confidence, 0), 2),
            "reason": reason,
        }
        if scores is not None:
            result["scores"] = scores
        return result

    def _after_pattern(self, text: str, patterns: list[str]) -> str:
        lower = text.lower()
        for pattern in sorted(patterns, key=len, reverse=True):
            if pattern in lower:
                idx = lower.index(pattern) + len(pattern)
                return text[idx:].strip(" :,-")
        return ""

    def _after_keywords(self, text: str, keywords: tuple[str, ...]) -> str:
        tokens = text.split()
        kept = [token for token in tokens if token.lower() not in keywords]
        return " ".join(kept).strip(" :,-")
