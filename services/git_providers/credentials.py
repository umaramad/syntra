"""Git hosting API authentication credentials."""

from __future__ import annotations

import base64
from dataclasses import dataclass


VALID_AUTH_TYPES = ("pat", "password")


@dataclass(frozen=True)
class GitAuthCredentials:
    auth_type: str
    username: str
    secret: str

    @classmethod
    def from_login(
        cls,
        *,
        user_id: str,
        auth_type: str,
        token: str = "",
        password: str = "",
    ) -> "GitAuthCredentials":
        username = (user_id or "").strip()
        auth_type = (auth_type or "pat").strip().lower()

        if not username:
            raise ValueError("User ID is required")
        if auth_type not in VALID_AUTH_TYPES:
            raise ValueError("Auth type must be pat or password")

        if auth_type == "pat":
            secret = (token or "").strip()
            if not secret:
                raise ValueError("Personal access token is required")
        else:
            secret = password or ""
            if not secret.strip():
                raise ValueError("Password is required")
            secret = secret.strip()

        return cls(auth_type=auth_type, username=username, secret=secret)

    def authorization_header(self, provider: str) -> dict[str, str]:
        provider = (provider or "github").lower()
        if self.auth_type == "pat":
            if provider == "gitlab":
                return {"PRIVATE-TOKEN": self.secret}
            return {"Authorization": f"Bearer {self.secret}"}

        encoded = base64.b64encode(f"{self.username}:{self.secret}".encode("utf-8")).decode("ascii")
        return {"Authorization": f"Basic {encoded}"}
