"""Bitbucket Cloud REST API provider."""

from __future__ import annotations

from typing import Any

from git_providers_config import get_api_base
from services.git_providers.base import BaseGitProvider
from services.git_providers.http_client import GitApiError, request_json


class BitbucketProvider(BaseGitProvider):
    provider_name = "bitbucket"

    @property
    def api_base(self) -> str:
        return get_api_base(self.provider_name)

    def validate_token(self) -> dict[str, Any]:
        user = request_json(f"{self.api_base}/user", headers=self._headers())
        return {
            "provider": self.provider_name,
            "login": user.get("username"),
            "name": user.get("display_name") or user.get("username"),
        }

    def list_branches(self, owner: str, repo: str) -> list[str]:
        return self._paginate_ref_names(f"{self.api_base}/repositories/{owner}/{repo}/refs/branches")

    def list_tags(self, owner: str, repo: str) -> list[str]:
        return self._paginate_ref_names(f"{self.api_base}/repositories/{owner}/{repo}/refs/tags")

    def resolve_ref(self, owner: str, repo: str, ref: str, ref_type: str) -> str:
        collection = "tags" if ref_type == "tag" else "branches"
        data = request_json(
            f"{self.api_base}/repositories/{owner}/{repo}/refs/{collection}/{ref}",
            headers=self._headers(),
        )
        return data["target"]["hash"]

    def list_paths(self, owner: str, repo: str, commit_sha: str) -> dict[str, str]:
        paths: dict[str, str] = {}
        self._walk_dir(owner, repo, commit_sha, "", paths)
        return paths

    def get_file_text(self, owner: str, repo: str, path: str, commit_sha: str) -> str:
        from urllib.request import Request, urlopen
        import ssl

        url = f"{self.api_base}/repositories/{owner}/{repo}/src/{commit_sha}/{path}"
        request = Request(url, headers=self._headers())
        context = ssl.create_default_context()
        with urlopen(request, timeout=30, context=context) as response:
            return response.read().decode("utf-8", errors="replace")

    def _paginate_ref_names(self, url: str) -> list[str]:
        names: list[str] = []
        next_url: str | None = url
        while next_url:
            data = request_json(next_url, headers=self._headers())
            for item in data.get("values", []):
                names.append(item["name"])
            next_url = data.get("next")
        return sorted(set(names), key=str.lower)

    def _walk_dir(
        self,
        owner: str,
        repo: str,
        commit_sha: str,
        prefix: str,
        paths: dict[str, str],
    ) -> None:
        url = f"{self.api_base}/repositories/{owner}/{repo}/src/{commit_sha}/{prefix}"
        data = request_json(url, headers=self._headers())
        for item in data.get("values", []):
            item_type = item.get("type")
            path = item["path"]
            if item_type == "commit_file":
                paths[path] = item.get("links", {}).get("self", {}).get("href", path)
            elif item_type == "commit_directory":
                self._walk_dir(owner, repo, commit_sha, path, paths)

        next_url = data.get("next")
        while next_url:
            data = request_json(next_url, headers=self._headers())
            for item in data.get("values", []):
                item_type = item.get("type")
                path = item["path"]
                if item_type == "commit_file":
                    paths[path] = item.get("links", {}).get("self", {}).get("href", path)
                elif item_type == "commit_directory":
                    self._walk_dir(owner, repo, commit_sha, path, paths)
            next_url = data.get("next")
