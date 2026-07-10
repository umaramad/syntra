"""Debug logging helpers for Git Compare (login and API connectivity)."""

from __future__ import annotations

import logging
from contextvars import ContextVar
from typing import Optional

import config

LOGGER_NAME = "syntra.git_compare"
_logger = logging.getLogger(LOGGER_NAME)

_login_trace: ContextVar[Optional[list[str]]] = ContextVar("git_compare_login_trace", default=None)


def is_debug_enabled() -> bool:
    return bool(getattr(config, "GIT_COMPARE_DEBUG", config.DEBUG))


def configure_logging() -> None:
    if not is_debug_enabled():
        return
    logger = logging.getLogger(LOGGER_NAME)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("[%(asctime)s] %(name)s %(levelname)s: %(message)s")
        )
        logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False


def begin_login_trace() -> list[str]:
    trace: list[str] = []
    _login_trace.set(trace)
    return trace


def end_login_trace() -> None:
    _login_trace.set(None)


def get_active_trace() -> Optional[list[str]]:
    return _login_trace.get()


def log_debug(message: str) -> None:
    if is_debug_enabled():
        _logger.info(message)
    trace = _login_trace.get()
    if trace is not None:
        trace.append(message)


def public_debug_trace() -> list[str]:
    trace = _login_trace.get()
    return list(trace) if trace else []
