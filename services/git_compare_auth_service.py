"""Authentication helpers for the Git Compare module."""

from __future__ import annotations

from typing import Any, Optional

from flask import session

from repositories.git_compare_user_repository import GitCompareUserRepository
from services.git_providers import get_provider
from services.git_providers.credentials import GitAuthCredentials
from services.git_providers.http_client import GitApiError


class GitCompareAuthService:
    SESSION_USER = "git_compare_user_id"
    SESSION_SECRET = "git_compare_secret"
    SESSION_AUTH_TYPE = "git_compare_auth_type"
    SESSION_PROVIDER = "git_compare_provider"
    SESSION_ACCOUNT = "git_compare_account"
    SESSION_TOKEN_LEGACY = "git_compare_token"

    def __init__(self, user_repository: Optional[GitCompareUserRepository] = None):
        self.user_repository = user_repository or GitCompareUserRepository()

    def login(
        self,
        user_id: str,
        provider: str = "github",
        *,
        auth_type: str = "pat",
        token: str = "",
        password: str = "",
    ) -> dict[str, Any]:
        provider = (provider or "github").strip().lower()
        credentials = GitAuthCredentials.from_login(
            user_id=user_id,
            auth_type=auth_type,
            token=token,
            password=password,
        )

        git_provider = get_provider(provider, credentials)
        try:
            account = git_provider.validate_token()
        except GitApiError as exc:
            label = "PAT" if credentials.auth_type == "pat" else "password"
            raise ValueError(f"Login failed ({label}): {exc}") from exc

        self.user_repository.upsert_login(credentials.username, provider)
        session[self.SESSION_USER] = credentials.username
        session[self.SESSION_SECRET] = credentials.secret
        session[self.SESSION_AUTH_TYPE] = credentials.auth_type
        session[self.SESSION_PROVIDER] = provider
        session[self.SESSION_ACCOUNT] = account.get("login") or credentials.username
        session.permanent = True

        return {
            "user_id": credentials.username,
            "provider": provider,
            "auth_type": credentials.auth_type,
            "account": session[self.SESSION_ACCOUNT],
        }

    def logout(self) -> None:
        for key in (
            self.SESSION_USER,
            self.SESSION_SECRET,
            self.SESSION_AUTH_TYPE,
            self.SESSION_PROVIDER,
            self.SESSION_ACCOUNT,
            self.SESSION_TOKEN_LEGACY,
        ):
            session.pop(key, None)
        session.permanent = False
        session.modified = True

    def current_user(self) -> Optional[dict[str, Any]]:
        user_id = session.get(self.SESSION_USER)
        if not user_id:
            return None
        return {
            "user_id": user_id,
            "provider": session.get(self.SESSION_PROVIDER, "github"),
            "auth_type": session.get(self.SESSION_AUTH_TYPE, "pat"),
            "account": session.get(self.SESSION_ACCOUNT, user_id),
        }

    def require_session(self) -> dict[str, Any]:
        user = self.current_user()
        secret = session.get(self.SESSION_SECRET) or session.get(self.SESSION_TOKEN_LEGACY)
        auth_type = session.get(self.SESSION_AUTH_TYPE, "pat")
        if not user or not secret:
            raise PermissionError("Not authenticated")
        return {**user, "secret": secret, "auth_type": auth_type}

    def get_credentials(self) -> GitAuthCredentials:
        session_data = self.require_session()
        return GitAuthCredentials(
            auth_type=session_data["auth_type"],
            username=session_data["user_id"],
            secret=session_data["secret"],
        )

    def get_provider(self):
        session_data = self.require_session()
        return get_provider(session_data["provider"], self.get_credentials())
