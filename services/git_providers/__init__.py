"""Factory for Git hosting providers."""

from __future__ import annotations

from services.git_providers.base import BaseGitProvider
from services.git_providers.bitbucket_provider import BitbucketProvider
from services.git_providers.credentials import GitAuthCredentials
from services.git_providers.github_provider import GitHubProvider
from services.git_providers.gitlab_provider import GitLabProvider

PROVIDERS: dict[str, type[BaseGitProvider]] = {
    "github": GitHubProvider,
    "bitbucket": BitbucketProvider,
    "gitlab": GitLabProvider,
}


def get_provider(provider: str, credentials: GitAuthCredentials) -> BaseGitProvider:
    key = (provider or "github").lower()
    cls = PROVIDERS.get(key)
    if not cls:
        raise ValueError(f"Unsupported provider: {provider}")
    return cls(credentials)
