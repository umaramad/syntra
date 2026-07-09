"""Base Git provider interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from services.git_providers.credentials import GitAuthCredentials


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
