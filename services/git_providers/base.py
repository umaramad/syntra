"""Base Git provider interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from services.git_providers.credentials import GitAuthCredentials
from services.git_providers.http_client import request_json, request_text


class BaseGitProvider(ABC):
    provider_name: str

    def __init__(self, credentials: GitAuthCredentials):
        self.credentials = credentials

    def _headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "User-Agent": "Syntra-GitCompare",
        }
        headers.update(self.credentials.authorization_header(self.provider_name))
        return headers

    def api_json(self, url: str, **kwargs: Any) -> Any:
        kwargs.setdefault("headers", self._headers())
        kwargs["provider"] = self.provider_name
        return request_json(url, **kwargs)

    def api_text(self, url: str, **kwargs: Any) -> str:
        kwargs.setdefault("headers", self._headers())
        kwargs["provider"] = self.provider_name
        return request_text(url, **kwargs)

    @abstractmethod
    def validate_token(self) -> dict[str, Any]:
        """Return basic account info when credentials are valid."""

    @abstractmethod
    def list_branches(self, owner: str, repo: str) -> list[str]:
        pass

    @abstractmethod
    def list_tags(self, owner: str, repo: str) -> list[str]:
        pass

    @abstractmethod
    def resolve_ref(self, owner: str, repo: str, ref: str, ref_type: str) -> str:
        """Resolve a branch or tag name to a commit SHA."""

    @abstractmethod
    def list_paths(self, owner: str, repo: str, commit_sha: str) -> dict[str, str]:
        """Return a map of file path -> blob identifier at the given commit."""

    @abstractmethod
    def get_file_text(self, owner: str, repo: str, path: str, commit_sha: str) -> str:
        pass
