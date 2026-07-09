"""Parse and normalize Git hosting repository identifiers."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

SUPPORTED_PROVIDERS = ("github", "bitbucket", "gitlab")


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


def detect_provider_from_host(host: str) -> Optional[str]:
    host = host.lower().removeprefix("www.")
    if host in ("github.com",):
        return "github"
    if host in ("bitbucket.org",):
        return "bitbucket"
    if host in ("gitlab.com",):
        return "gitlab"
    return None


def parse_repo(value: str, default_provider: str = "github") -> RepoRef:
    text = (value or "").strip()
    if not text:
        raise ValueError("Repository is required")

    if text.startswith("http://") or text.startswith("https://"):
        parsed = urlparse(text)
        provider = detect_provider_from_host(parsed.hostname or "")
        if not provider:
            raise ValueError("Unsupported Git host. Use GitHub, Bitbucket, or GitLab URLs.")
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
        'Repository must look like "owner/repo" or a full GitHub/Bitbucket/GitLab URL'
    )
