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
        },
    )
    assert get_api_base("gitlab") == "https://gitlab.mycompany.com/api/v4"
    assert detect_provider_from_host("gitlab.mycompany.com") == "gitlab"
