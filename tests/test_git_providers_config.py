from git_providers_config import detect_provider_from_host, get_api_base


def test_default_github_api_base():
    assert get_api_base("github") == "https://api.github.com"


def test_default_bitbucket_api_base():
    assert get_api_base("bitbucket") == "https://api.bitbucket.org/2.0"


def test_detect_provider_from_configured_host():
    assert detect_provider_from_host("github.com") == "github"
    assert detect_provider_from_host("www.bitbucket.org") == "bitbucket"


def test_custom_host_after_config_override(monkeypatch):
    import git_providers_config as provider_config

    monkeypatch.setitem(
        provider_config.GIT_PROVIDERS,
        "gitlab",
        {
            "label": "GitLab",
            "api_base": "https://gitlab.mycompany.com/api/v4",
            "web_hosts": ["gitlab.mycompany.com"],
            "proxy": {"enabled": False, "url": "", "username": "", "password": ""},
        },
    )
    assert get_api_base("gitlab") == "https://gitlab.mycompany.com/api/v4"
    assert detect_provider_from_host("gitlab.mycompany.com") == "gitlab"


def test_github_proxy_enabled():
    import git_providers_config as provider_config

    original = provider_config.GIT_PROVIDERS["github"]["proxy"]
    try:
        provider_config.GIT_PROVIDERS["github"]["proxy"] = {
            "enabled": True,
            "url": "http://proxy.corp:8080",
            "username": "gituser",
            "password": "secret",
        }
        proxy_url = provider_config.get_proxy_url("github")
        assert proxy_url is not None
        assert proxy_url.startswith("http://gituser:")
        assert "proxy.corp:8080" in proxy_url
        proxy_map = provider_config.get_proxy_map("github")
        assert proxy_map["https"] == proxy_url
    finally:
        provider_config.GIT_PROVIDERS["github"]["proxy"] = original


def test_proxy_disabled_by_default():
    import git_providers_config as provider_config

    assert provider_config.get_proxy_url("github") is None
    assert provider_config.get_proxy_url("bitbucket") is None

