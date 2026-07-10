"""GitLab.com REST API provider."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from git_providers_config import get_api_base
from services.git_providers.base import BaseGitProvider


class GitLabProvider(BaseGitProvider):
    provider_name = "gitlab"

    @property
    def api_base(self) -> str:
        return get_api_base(self.provider_name)

    def _project_path(self, owner: str, repo: str) -> str:
        return quote(f"{owner}/{repo}", safe="")

    def validate_token(self) -> dict[str, Any]:
        user = self.api_json(f"{self.api_base}/user")
        return {
            "provider": self.provider_name,
            "login": user.get("username"),
            "name": user.get("name") or user.get("username"),
        }

    def list_branches(self, owner: str, repo: str) -> list[str]:
        project = self._project_path(owner, repo)
        return self._paginate_names(f"{self.api_base}/projects/{project}/repository/branches", "name")

    def list_tags(self, owner: str, repo: str) -> list[str]:
        project = self._project_path(owner, repo)
        return self._paginate_names(f"{self.api_base}/projects/{project}/repository/tags", "name")

    def resolve_ref(self, owner: str, repo: str, ref: str, ref_type: str) -> str:
        project = self._project_path(owner, repo)
        if ref_type == "tag":
            tags = self.api_json(
                f"{self.api_base}/projects/{project}/repository/tags",
                params={"search": ref},
            )
            for tag in tags:
                if tag.get("name") == ref:
                    return tag["commit"]["id"]
            raise ValueError(f"Tag not found: {ref}")
        data = self.api_json(
            f"{self.api_base}/projects/{project}/repository/branches/{quote(ref, safe='')}",
        )
        return data["commit"]["id"]

    def list_paths(self, owner: str, repo: str, commit_sha: str) -> dict[str, str]:
        project = self._project_path(owner, repo)
        page = 1
        paths: dict[str, str] = {}
        while True:
            data = self.api_json(
                f"{self.api_base}/projects/{project}/repository/tree",
                params={"ref": commit_sha, "recursive": "true", "per_page": 100, "page": page},
            )
            if not data:
                break
            for entry in data:
                if entry.get("type") == "blob":
                    paths[entry["path"]] = entry["id"]
            if len(data) < 100:
                break
            page += 1
        return paths

    def get_file_text(self, owner: str, repo: str, path: str, commit_sha: str) -> str:
        project = self._project_path(owner, repo)
        encoded_path = quote(path, safe="")
        url = f"{self.api_base}/projects/{project}/repository/files/{encoded_path}/raw?ref={commit_sha}"
        return self.api_text(url)

    def _paginate_names(self, url: str, field: str) -> list[str]:
        names: list[str] = []
        page = 1
        while True:
            data = self.api_json(url, params={"per_page": 100, "page": page})
            if not data:
                break
            names.extend(item[field] for item in data if field in item)
            if len(data) < 100:
                break
            page += 1
        return sorted(set(names), key=str.lower)
