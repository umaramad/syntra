"""
Git Compare — provider URL configuration.

Edit these values for cloud defaults, GitHub Enterprise, self-hosted GitLab/Bitbucket,
and corporate proxy access (common for GitHub behind a firewall).

Fields per provider:
  api_base   — REST API root used by Syntra (no trailing slash)
  web_hosts  — Hostnames recognized when users paste repository URLs
  proxy      — Optional per-provider proxy (see below)

Proxy (per provider, under the "proxy" key):
  enabled   — True to route this provider's API calls through a proxy
  url       — Proxy URL, e.g. "http://proxy.corp.local:8080"
  username  — Optional proxy username
  password  — Optional proxy password

Global proxy defaults (GIT_PROXY_DEFAULTS) apply when a provider has no "proxy" block.
Set proxy on GitHub only for firewall networks; leave bitbucket/gitlab disabled unless needed.

Environment overrides (optional):
  SYNTRA_GIT_PROXY_URL, SYNTRA_GIT_PROXY_USERNAME, SYNTRA_GIT_PROXY_PASSWORD
  SYNTRA_GITHUB_PROXY_URL — overrides GitHub proxy URL when set
"""

from __future__ import annotations

import os
from typing import Any
from urllib.parse import quote, urlparse, urlunparse

GIT_PROXY_DEFAULTS: dict[str, Any] = {
    "enabled": False,
    "url": "",
    "username": "",
    "password": "",
}

GIT_PROVIDERS: dict[str, dict[str, Any]] = {
    "github": {
        "label": "GitHub",
        "api_base": "https://api.github.com",
        "web_hosts": [
            "github.com",
        ],
        "proxy": {
            "enabled": False,
            "url": "",
            "username": "",
            "password": "",
        },
    },
    "bitbucket": {
        "label": "Bitbucket",
        "api_base": "https://api.bitbucket.org/2.0",
        "web_hosts": [
            "bitbucket.org",
        ],
        "proxy": {
            "enabled": False,
            "url": "",
            "username": "",
            "password": "",
        },
    },
    "gitlab": {
        "label": "GitLab",
        "api_base": "https://gitlab.com/api/v4",
        "web_hosts": [
            "gitlab.com",
        ],
        "proxy": {
            "enabled": False,
            "url": "",
            "username": "",
            "password": "",
        },
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


def _env_proxy_url(provider: str) -> str:
    if provider == "github":
        return (os.environ.get("SYNTRA_GITHUB_PROXY_URL") or "").strip()
    return (os.environ.get("SYNTRA_GIT_PROXY_URL") or "").strip()


def _merge_proxy_settings(provider: str) -> dict[str, Any]:
    provider_cfg = get_provider_config(provider)
    merged = {**GIT_PROXY_DEFAULTS, **(provider_cfg.get("proxy") or {})}

    env_url = _env_proxy_url(provider)
    if env_url:
        merged["url"] = env_url
        merged["enabled"] = True

    env_user = (os.environ.get("SYNTRA_GIT_PROXY_USERNAME") or "").strip()
    env_pass = (os.environ.get("SYNTRA_GIT_PROXY_PASSWORD") or "").strip()
    if env_user:
        merged["username"] = env_user
    if env_pass:
        merged["password"] = env_pass

    return merged


def get_proxy_url(provider: str | None) -> str | None:
    if not provider:
        return None

    settings = _merge_proxy_settings(provider)
    if not settings.get("enabled"):
        return None

    url = str(settings.get("url") or "").strip()
    if not url:
        return None

    username = str(settings.get("username") or "").strip()
    password = str(settings.get("password") or "")
    if not username:
        return url

    parsed = urlparse(url)
    host = parsed.hostname or ""
    if parsed.port:
        host = f"{host}:{parsed.port}"
    userinfo = f"{quote(username, safe='')}:{quote(password, safe='')}"
    netloc = f"{userinfo}@{host}"
    return urlunparse(
        (
            parsed.scheme or "http",
            netloc,
            parsed.path or "",
            parsed.params,
            parsed.query,
            parsed.fragment,
        )
    )


def get_proxy_map(provider: str | None) -> dict[str, str] | None:
    proxy_url = get_proxy_url(provider)
    if not proxy_url:
        return None
    return {"http": proxy_url, "https": proxy_url}
