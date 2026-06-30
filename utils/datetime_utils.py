"""Shared date/time helpers for Syntra.

Storage conventions (SQLite):
- Server timestamps (created_at, updated_at, comments): UTC as ``YYYY-MM-DD HH:MM:SS``
- Reminder remind_at: browser datetime-local value ``YYYY-MM-DDTHH:MM`` (local, no timezone)
- Due dates: date-only ``YYYY-MM-DD``
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional, Union

UTC_STORAGE_FORMAT = "%Y-%m-%d %H:%M:%S"

_SQLITE_UTC_RE = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$")
_ISO_UTC_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$")
_TZ_SUFFIX_RE = re.compile(r"[zZ]$|[+-]\d{2}:\d{2}$")


def utc_now() -> datetime:
    """Current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


def utc_now_str() -> str:
    """Current UTC time formatted for SQLite storage."""
    return utc_now().strftime(UTC_STORAGE_FORMAT)


def to_utc_storage_string(value: Union[datetime, str]) -> str:
    """Convert a datetime or ISO string to the SQLite UTC storage format."""
    if isinstance(value, str):
        parsed = parse_stored_utc(value)
        if parsed is None:
            raise ValueError(f"Unrecognized datetime value: {value!r}")
        value = parsed

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)

    return value.strftime(UTC_STORAGE_FORMAT)


def parse_stored_utc(value: Optional[str]) -> Optional[datetime]:
    """Parse a stored timestamp string into a timezone-aware UTC datetime.

    Matches the parsing rules used by ``static/js/datetime.js`` for server values.
    """
    if value is None:
        return None

    text = value.strip()
    if not text:
        return None

    if _TZ_SUFFIX_RE.search(text):
        normalized = text.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    if _SQLITE_UTC_RE.match(text):
        base = text.split(".", 1)[0]
        parsed = datetime.strptime(base, UTC_STORAGE_FORMAT)
        return parsed.replace(tzinfo=timezone.utc)

    if _ISO_UTC_RE.match(text):
        base = text.split(".", 1)[0]
        parsed = datetime.fromisoformat(base)
        return parsed.replace(tzinfo=timezone.utc)

    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None
