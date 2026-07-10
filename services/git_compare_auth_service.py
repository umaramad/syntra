"""Authentication helpers for the Git Compare module."""

from __future__ import annotations

from typing import Any, Optional

from flask import session

from git_providers_config import get_api_base, get_proxy_url
from repositories.git_compare_user_repository import GitCompareUserRepository
from services.git_providers import get_provider
from services.git_providers.credentials import GitAuthCredentials
from services.git_providers.http_client import GitApiError
from utils.git_compare_debug import begin_login_trace, end_login_trace, log_debug


class GitCompareLoginError(ValueError):
    def __init__(self, message: str, *, debug_trace: Optional[list[str]] = None):
        super().__init__(message)
        self.debug_trace = debug_trace or []


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
        trace = begin_login_trace()
        provider = (provider or "github").strip().lower()

        try:
            log_debug(f"Login started: provider={provider}, auth_type={auth_type}, user_id={user_id.strip()}")
            log_debug(f"API base: {get_api_base(provider)}")

            proxy_url = get_proxy_url(provider)
            if proxy_url:
                log_debug(f"Proxy enabled for {provider}")
            else:
                log_debug(f"Proxy disabled for {provider}")

            credentials = GitAuthCredentials.from_login(
                user_id=user_id,
                auth_type=auth_type,
                token=token,
                password=password,
            )
            log_debug("Credentials validated locally (secrets not logged)")

            git_provider = get_provider(provider, credentials)
            log_debug(f"Calling {provider} API to verify account…")

            try:
                account = git_provider.validate_token()
            except GitApiError as exc:
                label = "PAT" if credentials.auth_type == "pat" else "password"
                log_debug(f"Git API rejected login: status={exc.status}, message={exc}")
                raise GitCompareLoginError(
                    f"Login failed ({label}): {exc}",
                    debug_trace=list(trace),
                ) from exc

            account_login = account.get("login") or credentials.username
            log_debug(f"Git API accepted login for account: {account_login}")

            self.user_repository.upsert_login(credentials.username, provider)
            session[self.SESSION_USER] = credentials.username
            session[self.SESSION_SECRET] = credentials.secret
            session[self.SESSION_AUTH_TYPE] = credentials.auth_type
            session[self.SESSION_PROVIDER] = provider
            session[self.SESSION_ACCOUNT] = account_login
            session.permanent = True

            log_debug("Session created successfully")
            return {
                "user_id": credentials.username,
                "provider": provider,
                "auth_type": credentials.auth_type,
                "account": account_login,
                "debug": list(trace),
            }
        except GitCompareLoginError:
            raise
        except ValueError as exc:
            log_debug(f"Login validation error: {exc}")
            raise GitCompareLoginError(str(exc), debug_trace=list(trace)) from exc
        except Exception as exc:
            log_debug(f"Unexpected login error: {type(exc).__name__}: {exc}")
            raise GitCompareLoginError(
                f"Login failed: {exc}",
                debug_trace=list(trace),
            ) from exc
        finally:
            end_login_trace()

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
