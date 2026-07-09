from unittest.mock import MagicMock

import pytest

from services.git_compare_service import GitCompareService


class FakeProvider:
    provider_name = "github"

    def resolve_ref(self, owner, repo, ref, ref_type):
        return f"sha-{owner}-{repo}-{ref}"

    def list_paths(self, owner, repo, commit_sha):
        if repo == "left":
            return {"README.md": "blob-a", "removed.txt": "blob-b"}
        return {"README.md": "blob-c", "added.txt": "blob-d"}

    def get_file_text(self, owner, repo, path, commit_sha):
        if path == "README.md":
            return "line one\n" if repo == "left" else "line one\nline two\n"
        if path == "removed.txt":
            return "gone"
        if path == "added.txt":
            return "new file"
        return ""


def test_compare_cross_repo(monkeypatch):
    auth = MagicMock()
    auth.require_session.return_value = {"user_id": "dev1", "secret": "token", "auth_type": "pat", "provider": "github"}
    auth.get_provider.return_value = FakeProvider()

    history = MagicMock()
    history.create_entry.side_effect = lambda payload: MagicMock(id=99)

    service = GitCompareService(auth_service=auth, history_repository=history)

    result = service.compare(
        from_repo_value="acme/left",
        to_repo_value="acme/right",
        from_ref="main",
        from_ref_type="branch",
        to_ref="release",
        to_ref_type="tag",
    )

    assert result["stats"]["added"] == 1
    assert result["stats"]["removed"] == 1
    assert result["stats"]["modified"] == 1
    assert result["history_id"] == 99
    assert any(file["path"] == "README.md" and file["status"] == "modified" for file in result["files"])
