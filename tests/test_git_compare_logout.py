import pytest

from services.git_compare_auth_service import GitCompareAuthService


@pytest.fixture()
def client(db_path):
    from app import create_app

    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


def test_logout_clears_git_compare_session(client):
    with client.session_transaction() as sess:
        sess[GitCompareAuthService.SESSION_USER] = "alice"
        sess[GitCompareAuthService.SESSION_SECRET] = "secret"
        sess[GitCompareAuthService.SESSION_PROVIDER] = "github"
        sess.permanent = True

    response = client.post("/git-compare/api/logout")
    assert response.status_code == 200
    assert response.get_json()["success"] is True

    with client.session_transaction() as sess:
        assert GitCompareAuthService.SESSION_USER not in sess
        assert GitCompareAuthService.SESSION_SECRET not in sess
        assert sess.get("permanent") is not True


def test_login_page_accessible_after_logout(client):
    with client.session_transaction() as sess:
        sess[GitCompareAuthService.SESSION_USER] = "alice"
        sess[GitCompareAuthService.SESSION_SECRET] = "secret"

    client.post("/git-compare/api/logout")
    response = client.get("/git-compare/login")
    assert response.status_code == 200
    assert b"Git Compare" in response.data
