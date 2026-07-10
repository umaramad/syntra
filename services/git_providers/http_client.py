"""Minimal JSON HTTP client for Git provider APIs."""

from __future__ import annotations

import json
import ssl
from typing import Any, Optional
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import HTTPSHandler, ProxyHandler, Request, build_opener, urlopen

from git_providers_config import get_proxy_map

DEFAULT_TIMEOUT = 30


class GitApiError(Exception):
    def __init__(self, message: str, status: int = 0):
        super().__init__(message)
        self.status = status


def _ssl_context() -> ssl.SSLContext:
    return ssl.create_default_context()


def open_request(
    request: Request,
    *,
    provider: str | None = None,
    timeout: int = DEFAULT_TIMEOUT,
):
    context = _ssl_context()
    proxy_map = get_proxy_map(provider)
    if proxy_map:
        opener = build_opener(ProxyHandler(proxy_map), HTTPSHandler(context=context))
        return opener.open(request, timeout=timeout)
    return urlopen(request, timeout=timeout, context=context)


def request_bytes(
    url: str,
    *,
    headers: Optional[dict[str, str]] = None,
    provider: str | None = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> bytes:
    request = Request(url, headers=dict(headers or {}))
    try:
        with open_request(request, provider=provider, timeout=timeout) as response:
            return response.read()
    except HTTPError as exc:
        raise _http_error(exc) from exc
    except Exception as exc:
        raise GitApiError(str(exc)) from exc


def request_text(
    url: str,
    *,
    headers: Optional[dict[str, str]] = None,
    provider: str | None = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> str:
    return request_bytes(
        url,
        headers=headers,
        provider=provider,
        timeout=timeout,
    ).decode("utf-8", errors="replace")


def request_json(
    url: str,
    *,
    headers: Optional[dict[str, str]] = None,
    params: Optional[dict[str, Any]] = None,
    method: str = "GET",
    body: Optional[dict[str, Any]] = None,
    provider: str | None = None,
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

    try:
        with open_request(request, provider=provider, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            if not raw:
                return None
            return json.loads(raw)
    except HTTPError as exc:
        raise _http_error(exc) from exc
    except Exception as exc:
        raise GitApiError(str(exc)) from exc


def _http_error(exc: HTTPError) -> GitApiError:
    detail = ""
    try:
        detail = exc.read().decode("utf-8")
        parsed = json.loads(detail)
        if isinstance(parsed, dict):
            detail = parsed.get("message") or parsed.get("error") or detail
    except Exception:
        pass
    message = str(detail or exc.reason or "Git API request failed")
    return GitApiError(message, status=exc.code)
