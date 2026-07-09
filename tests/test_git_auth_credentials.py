import base64

import pytest

from services.git_providers.credentials import GitAuthCredentials


def test_pat_credentials_github_bearer():
    creds = GitAuthCredentials.from_login(
        user_id="dev",
        auth_type="pat",
        token="ghp_test",
    )
    headers = creds.authorization_header("github")
    assert headers["Authorization"] == "Bearer ghp_test"


def test_pat_credentials_gitlab_private_token():
    creds = GitAuthCredentials.from_login(
        user_id="dev",
        auth_type="pat",
        token="glpat-test",
    )
    headers = creds.authorization_header("gitlab")
    assert headers["PRIVATE-TOKEN"] == "glpat-test"
    assert "Authorization" not in headers


def test_password_credentials_basic_auth():
    creds = GitAuthCredentials.from_login(
        user_id="alice",
        auth_type="password",
        password="secret",
    )
    headers = creds.authorization_header("bitbucket")
    expected = base64.b64encode(b"alice:secret").decode("ascii")
    assert headers["Authorization"] == f"Basic {expected}"


def test_pat_requires_token():
    with pytest.raises(ValueError, match="token"):
        GitAuthCredentials.from_login(user_id="dev", auth_type="pat", token="")


def test_password_requires_password():
    with pytest.raises(ValueError, match="Password"):
        GitAuthCredentials.from_login(user_id="dev", auth_type="password", password="")
