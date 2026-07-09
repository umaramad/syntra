import pytest

from utils.git_repo_utils import RepoRef, parse_repo


def test_parse_owner_repo_github_default():
    repo = parse_repo("octocat/Hello-World", default_provider="github")
    assert repo == RepoRef(provider="github", owner="octocat", name="Hello-World")


def test_parse_github_url():
    repo = parse_repo("https://github.com/octocat/Hello-World.git")
    assert repo.provider == "github"
    assert repo.slug == "octocat/Hello-World"


def test_parse_bitbucket_url():
    repo = parse_repo("https://bitbucket.org/workspace/my-repo")
    assert repo.provider == "bitbucket"
    assert repo.owner == "workspace"
    assert repo.name == "my-repo"


def test_parse_invalid_repo():
    with pytest.raises(ValueError):
        parse_repo("not-a-valid-repo")
