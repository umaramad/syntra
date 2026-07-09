"""Parse and normalize Git hosting repository identifiers."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

from git_providers_config import GIT_PROVIDERS, detect_provider_from_host

SUPPORTED_PROVIDERS = tuple(GIT_PROVIDERS.keys())


@dataclass(frozen=True)
class RepoRef:
    provider: str
    owner: str
    name: str

    @property
    def slug(self) -> str:
        return f"{self.owner}/{self.name}"

    def to_dict(self) -> dict:
        return {
            "provider": self.provider,
            "owner": self.owner,
            "name": self.name,
            "slug": self.slug,
        }


def parse_repo(value: str, default_provider: str = "github") -> RepoRef:
    text = (value or "").strip()
    if not text:
        raise ValueError("Repository is required")

    if text.startswith("http://") or text.startswith("https://"):
        parsed = urlparse(text)
        provider = detect_provider_from_host(parsed.hostname or "")
        if not provider:
            raise ValueError(
                "Unsupported Git host. Configure web_hosts in git_providers_config.py "
                "or use owner/repo with the provider selected at login."
            )
        parts = [part for part in parsed.path.strip("/").split("/") if part]
        if len(parts) < 2:
            raise ValueError("Repository URL must include owner and repo name")
        owner, name = parts[0], parts[1].removesuffix(".git")
        return RepoRef(provider=provider, owner=owner, name=name)

    if re.match(r"^[\w.-]+/[\w.-]+$", text):
        owner, name = text.split("/", 1)
        provider = default_provider if default_provider in SUPPORTED_PROVIDERS else "github"
        return RepoRef(provider=provider, owner=owner, name=name.removesuffix(".git"))

    raise ValueError(
        'Repository must look like "owner/repo" or a full Git hosting URL'
    )
