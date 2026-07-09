"""GitHub REST API provider."""

from __future__ import annotations

import base64
from typing import Any

from urllib.parse import quote

from git_providers_config import get_api_base
from services.git_providers.base import BaseGitProvider
from services.git_providers.http_client import GitApiError, request_json


class GitHubProvider(BaseGitProvider):
    provider_name = "github"

    @property
    def api_base(self) -> str:
        return get_api_base(self.provider_name)

    def _headers(self) -> dict[str, str]:
        headers = super()._headers()
        headers.update(
            {
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
        )
        return headers

    def validate_token(self) -> dict[str, Any]:
        user = request_json(f"{self.api_base}/user", headers=self._headers())
        return {
            "provider": self.provider_name,
            "login": user.get("login"),
            "name": user.get("name") or user.get("login"),
        }

    def list_branches(self, owner: str, repo: str) -> list[str]:
        return self._paginate_names(f"{self.api_base}/repos/{owner}/{repo}/branches", "name")

    def list_tags(self, owner: str, repo: str) -> list[str]:
        return self._paginate_names(f"{self.api_base}/repos/{owner}/{repo}/tags", "name")

    def resolve_ref(self, owner: str, repo: str, ref: str, ref_type: str) -> str:
        if ref_type == "tag":
            data = request_json(
                f"{self.api_base}/repos/{owner}/{repo}/git/ref/tags/{quote(ref, safe='')}",
                headers=self._headers(),
            )
            obj = data.get("object") or {}
            if obj.get("type") == "tag":
                tag_obj = request_json(obj.get("url"), headers=self._headers())
                return tag_obj["object"]["sha"]
            return obj.get("sha", "")
        data = request_json(
            f"{self.api_base}/repos/{owner}/{repo}/git/ref/heads/{quote(ref, safe='')}",
            headers=self._headers(),
        )
        return data["object"]["sha"]

    def list_paths(self, owner: str, repo: str, commit_sha: str) -> dict[str, str]:
        commit = request_json(
            f"{self.api_base}/repos/{owner}/{repo}/git/commits/{commit_sha}",
            headers=self._headers(),
        )
        tree_sha = commit["tree"]["sha"]
        tree = request_json(
            f"{self.api_base}/repos/{owner}/{repo}/git/trees/{tree_sha}",
            headers=self._headers(),
            params={"recursive": "1"},
        )
        paths: dict[str, str] = {}
        for entry in tree.get("tree", []):
            if entry.get("type") == "blob":
                paths[entry["path"]] = entry["sha"]
        return paths

    def get_file_text(self, owner: str, repo: str, path: str, commit_sha: str) -> str:
        data = request_json(
            f"{self.api_base}/repos/{owner}/{repo}/contents/{path}",
            headers=self._headers(),
            params={"ref": commit_sha},
        )
        if isinstance(data, list):
            raise GitApiError(f"Path is a directory: {path}")
        content = data.get("content", "")
        encoding = data.get("encoding", "base64")
        if encoding == "base64":
            return base64.b64decode(content).decode("utf-8", errors="replace")
        return content

    def _paginate_names(self, url: str, field: str) -> list[str]:
        names: list[str] = []
        page = 1
        while True:
            data = request_json(
                url,
                headers=self._headers(),
                params={"per_page": 100, "page": page},
            )
            if not data:
                break
            names.extend(item[field] for item in data if field in item)
            if len(data) < 100:
                break
            page += 1
        return sorted(set(names), key=str.lower)
