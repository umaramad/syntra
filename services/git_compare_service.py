"""Cross-repository Git comparison using hosting provider APIs."""

from __future__ import annotations

import difflib
from typing import Any, Optional

import config
from repositories.git_compare_history_repository import GitCompareHistoryRepository
from services.git_compare_auth_service import GitCompareAuthService
from services.git_providers.base import BaseGitProvider
from services.git_providers.http_client import GitApiError
from utils.git_repo_utils import RepoRef, parse_repo


class GitCompareService:
    def __init__(
        self,
        auth_service: Optional[GitCompareAuthService] = None,
        history_repository: Optional[GitCompareHistoryRepository] = None,
    ):
        self.auth_service = auth_service or GitCompareAuthService()
        self.history_repository = history_repository or GitCompareHistoryRepository()

    def list_refs(self, repo_value: str) -> dict[str, Any]:
        provider = self.auth_service.get_provider()
        repo = parse_repo(repo_value, default_provider=provider.provider_name)
        self._ensure_provider_matches(repo.provider, provider)
        return {
            "repo": repo.to_dict(),
            "branches": provider.list_branches(repo.owner, repo.name),
            "tags": provider.list_tags(repo.owner, repo.name),
        }

    def compare(
        self,
        *,
        from_repo_value: str,
        to_repo_value: str,
        from_ref: str,
        from_ref_type: str,
        to_ref: str,
        to_ref_type: str,
        save_history: bool = True,
    ) -> dict[str, Any]:
        session_data = self.auth_service.require_session()
        provider = self.auth_service.get_provider()

        from_repo = parse_repo(from_repo_value, default_provider=provider.provider_name)
        to_repo = parse_repo(to_repo_value, default_provider=provider.provider_name)
        self._ensure_provider_matches(from_repo.provider, provider)
        self._ensure_provider_matches(to_repo.provider, provider)

        from_ref = (from_ref or "").strip()
        to_ref = (to_ref or "").strip()
        from_ref_type = self._normalize_ref_type(from_ref_type)
        to_ref_type = self._normalize_ref_type(to_ref_type)

        if not from_ref or not to_ref:
            raise ValueError("Both source and target refs are required")

        from_sha = provider.resolve_ref(from_repo.owner, from_repo.name, from_ref, from_ref_type)
        to_sha = provider.resolve_ref(to_repo.owner, to_repo.name, to_ref, to_ref_type)

        from_paths = provider.list_paths(from_repo.owner, from_repo.name, from_sha)
        to_paths = provider.list_paths(to_repo.owner, to_repo.name, to_sha)

        all_paths = sorted(set(from_paths) | set(to_paths))
        files: list[dict[str, Any]] = []
        stats = {"added": 0, "removed": 0, "modified": 0, "unchanged": 0, "skipped": 0}

        for path in all_paths:
            in_from = path in from_paths
            in_to = path in to_paths
            if in_from and not in_to:
                status = "removed"
                left_text = self._safe_file_text(provider, from_repo, path, from_sha)
                right_text = ""
            elif in_to and not in_from:
                status = "added"
                left_text = ""
                right_text = self._safe_file_text(provider, to_repo, path, to_sha)
            elif from_paths[path] == to_paths[path]:
                stats["unchanged"] += 1
                continue
            else:
                status = "modified"
                left_text = self._safe_file_text(provider, from_repo, path, from_sha)
                right_text = self._safe_file_text(provider, to_repo, path, to_sha)

            if left_text is None or right_text is None:
                stats["skipped"] += 1
                files.append(
                    {
                        "path": path,
                        "status": status,
                        "skipped": True,
                        "reason": "Binary or unreadable file",
                        "left": "",
                        "right": "",
                        "unified_diff": "",
                    }
                )
                continue

            stats[status] += 1
            files.append(
                {
                    "path": path,
                    "status": status,
                    "skipped": False,
                    "left": left_text,
                    "right": right_text,
                    "unified_diff": self._unified_diff(left_text, right_text, path),
                }
            )

            if len([item for item in files if not item.get("skipped")]) >= config.GIT_COMPARE_MAX_FILES:
                stats["truncated"] = True
                break

        result = {
            "from": {
                "repo": from_repo.to_dict(),
                "ref": from_ref,
                "ref_type": from_ref_type,
                "commit": from_sha,
            },
            "to": {
                "repo": to_repo.to_dict(),
                "ref": to_ref,
                "ref_type": to_ref_type,
                "commit": to_sha,
            },
            "stats": stats,
            "files": files,
        }

        if save_history:
            entry = self.history_repository.create_entry(
                {
                    "user_id": session_data["user_id"],
                    "provider": provider.provider_name,
                    "from_repo": from_repo.slug,
                    "to_repo": to_repo.slug,
                    "from_ref": from_ref,
                    "from_ref_type": from_ref_type,
                    "to_ref": to_ref,
                    "to_ref_type": to_ref_type,
                    "stats": stats,
                    "files": files,
                }
            )
            result["history_id"] = entry.id

        return result

    def list_history(self) -> list[dict[str, Any]]:
        session_data = self.auth_service.require_session()
        return [
            item.to_dict()
            for item in self.history_repository.list_for_user(session_data["user_id"])
        ]

    def get_history(self, entry_id: int, *, include_files: bool = False) -> dict[str, Any]:
        session_data = self.auth_service.require_session()
        entry = self.history_repository.find_for_user(entry_id, session_data["user_id"])
        if not entry:
            raise ValueError("Comparison not found")
        return entry.to_dict(include_files=include_files)

    def _ensure_provider_matches(self, repo_provider: str, client: BaseGitProvider) -> None:
        if repo_provider != client.provider_name:
            raise ValueError(
                f"Repository host ({repo_provider}) does not match login provider ({client.provider_name})"
            )

    @staticmethod
    def _normalize_ref_type(ref_type: str) -> str:
        value = (ref_type or "branch").strip().lower()
        if value not in ("branch", "tag"):
            raise ValueError("Ref type must be branch or tag")
        return value

    @staticmethod
    def _safe_file_text(
        provider: BaseGitProvider,
        repo: RepoRef,
        path: str,
        commit_sha: str,
    ) -> Optional[str]:
        try:
            text = provider.get_file_text(repo.owner, repo.name, path, commit_sha)
            if len(text.encode("utf-8")) > config.GIT_COMPARE_MAX_FILE_BYTES:
                return None
            if "\x00" in text:
                return None
            return text
        except (GitApiError, UnicodeError, ValueError):
            return None

    @staticmethod
    def _unified_diff(left_text: str, right_text: str, path: str) -> str:
        left_lines = left_text.splitlines()
        right_lines = right_text.splitlines()
        diff = difflib.unified_diff(
            left_lines,
            right_lines,
            fromfile=f"a/{path}",
            tofile=f"b/{path}",
            lineterm="",
        )
        return "\n".join(diff)
