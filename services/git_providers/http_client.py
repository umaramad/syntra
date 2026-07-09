"""Minimal JSON HTTP client for Git provider APIs."""

from __future__ import annotations

import json
import ssl
from typing import Any, Optional
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DEFAULT_TIMEOUT = 30


class GitApiError(Exception):
    def __init__(self, message: str, status: int = 0):
        super().__init__(message)
        self.status = status


def request_json(
    url: str,
    *,
    headers: Optional[dict[str, str]] = None,
    params: Optional[dict[str, Any]] = None,
    method: str = "GET",
    body: Optional[dict[str, Any]] = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> Any:
    if params:
        query = urlencode({key: value for key, value in params.items() if value is not None})
        url = f"{url}?{query}" if query else url

    payload = None
    req_headers = dict(headers or {})
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")

    request = Request(url, data=payload, headers=req_headers, method=method)
    context = ssl.create_default_context()

    try:
        with urlopen(request, timeout=timeout, context=context) as response:
            raw = response.read().decode("utf-8")
            if not raw:
                return None
            return json.loads(raw)
    except HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
            parsed = json.loads(detail)
            if isinstance(parsed, dict):
                detail = parsed.get("message") or parsed.get("error") or detail
        except Exception:
            pass
        message = str(detail or exc.reason or "Git API request failed")
        raise GitApiError(message, status=exc.code) from exc
    except Exception as exc:
        raise GitApiError(str(exc)) from exc
