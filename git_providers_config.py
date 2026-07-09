"""
Git Compare — provider URL configuration.

Edit these values for cloud defaults, GitHub Enterprise, or self-hosted GitLab/Bitbucket.

Fields per provider:
  api_base   — REST API root used by Syntra (no trailing slash)
  web_hosts  — Hostnames recognized when users paste repository URLs

Examples:
  GitHub Enterprise:
    "api_base": "https://github.mycompany.com/api/v3",
    "web_hosts": ["github.mycompany.com"],

  Self-hosted GitLab:
    "api_base": "https://gitlab.mycompany.com/api/v4",
    "web_hosts": ["gitlab.mycompany.com"],
"""

from __future__ import annotations

from typing import Any

GIT_PROVIDERS: dict[str, dict[str, Any]] = {
    "github": {
        "label": "GitHub",
        "api_base": "https://api.github.com",
        "web_hosts": [
            "github.com",
        ],
    },
    "bitbucket": {
        "label": "Bitbucket",
        "api_base": "https://api.bitbucket.org/2.0",
        "web_hosts": [
            "bitbucket.org",
        ],
    },
    "gitlab": {
        "label": "GitLab",
        "api_base": "https://gitlab.com/api/v4",
        "web_hosts": [
            "gitlab.com",
        ],
    },
}


def get_provider_config(provider: str) -> dict[str, Any]:
    key = (provider or "").strip().lower()
    if key not in GIT_PROVIDERS:
        raise ValueError(f"Unknown Git provider: {provider}")
    return GIT_PROVIDERS[key]


def get_api_base(provider: str) -> str:
    return str(get_provider_config(provider)["api_base"]).rstrip("/")


def get_web_hosts(provider: str) -> tuple[str, ...]:
    hosts = get_provider_config(provider).get("web_hosts") or ()
    return tuple(str(host).lower().removeprefix("www.") for host in hosts)


def detect_provider_from_host(host: str) -> str | None:
    normalized = (host or "").lower().removeprefix("www.")
    for provider, settings in GIT_PROVIDERS.items():
        if normalized in get_web_hosts(provider):
            return provider
    return None


def list_provider_options() -> list[dict[str, str]]:
    return [
        {"id": provider, "label": str(settings.get("label", provider.title()))}
        for provider, settings in GIT_PROVIDERS.items()
    ]
