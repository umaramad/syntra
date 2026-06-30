#!/usr/bin/env python3
"""One-time helper: split monolithic app.js into Syntra namespace modules."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "static" / "js" / "app.js"
OUT_DIR = ROOT / "static" / "js" / "syntra"

STATE_VARS = [
    "taskCache",
    "taskGroupCache",
    "archivedGroupCache",
    "expandedTaskGroups",
    "expandedArchivedGroups",
    "expandedTaskComments",
    "standupBodyCollapsed",
    "taskCommentsCache",
    "noteCache",
    "teamCache",
    "reminderCache",
    "profileCache",
    "settingsCache",
    "searchQuery",
    "taskFilters",
    "notifiedReminderIds",
    "reminderPollTimer",
    "nextReminderTimer",
    "reminderPopupZCounter",
    "reminderVisibilityBound",
    "tabAttentionTimer",
    "tabAttentionListenersBound",
    "cachedDefaultTitle",
    "cachedFaviconLink",
    "cachedDefaultFaviconHref",
    "systemThemeListenerBound",
    "reminderAudioContext",
    "confirmResolver",
]

CONST_VARS = [
    "API",
    "TASK_TOOLS",
    "NOTE_TOOLS",
    "REMINDER_FAST_POLL_MS",
    "REMINDER_SNOOZE_PRESETS",
    "TAB_ATTENTION_INTERVAL_MS",
    "DEFAULT_PAGE_TITLE",
    "DEFAULT_FAVICON_HREF",
    "ALERT_FAVICON_HREF",
    "VALID_THEMES",
    "THEME_STORAGE_KEY",
    "SIDEBAR_STORAGE_KEY",
    "ONBOARDING_STORAGE_KEY",
    "STANDUP_STATUSES",
    "CONFIRM_ICONS",
    "DELETE_ICON",
    "COPY_ICON",
]

DT_VARS = [
    "formatDateTime",
    "toLocalDateTimeValue",
    "formatDateInput",
    "isToday",
    "isOverdue",
    "nowFormatted",
    "parseStoredDateTime",
    "localDateString",
]

MODULE_RANGES: list[tuple[str, int, int]] = [
    ("bootstrap", 1, 70),
    ("core", 72, 187),
    ("profile", 189, 245),
    ("settings", 247, 491),
    ("search", 545, 797),
    ("reminders", 799, 1258),
    ("ui", 1261, 1305),
    ("tasks", 1307, 2268),
    ("dashboard", 2270, 2362),
    ("ui", 2364, 2451),
    ("tasks", 2453, 2687),
    ("forms", 2689, 3149),
    ("mcp", 3152, 3261),
    ("settings", 3263, 3293),
    ("app", 3295, 3356),
]

MODULE_HEADER = """(function (global) {{
  "use strict";

  const Syntra = global.Syntra;
  const {{ state, constants, core, profile, settings, search, reminders, ui, tasks, notes, team, mcp }} = Syntra;
  const {{
    formatDateTime,
    toLocalDateTimeValue,
    formatDateInput,
    isToday,
    isOverdue,
    nowFormatted,
    parseStoredDateTime,
    localDateString,
  }} = global.SyntraDateTime;
{destructure}
"""

MODULE_FOOTER = """
})(window);
"""


def read_lines() -> list[str]:
    return APP_JS.read_text(encoding="utf-8").splitlines(keepends=True)


def transform_body(body: str, module: str) -> str:
    for name in STATE_VARS:
        body = re.sub(rf"\b{name}\b", f"state.{name}", body)
    for name in CONST_VARS:
        body = re.sub(rf"\b{name}\b", f"constants.{name}", body)

    # Avoid double state.state or constants.constants
    body = body.replace("state.state.", "state.")
    body = body.replace("constants.constants.", "constants.")

    if module != "bootstrap":
        body = body.replace("let state.confirmResolver", "state.confirmResolver")
        body = body.replace("const constants.", "// moved to bootstrap: constants.")

    return body


def build_bootstrap(lines: list[str]) -> str:
    body = "".join(lines[0:70])
    body = body.replace("let ", "  ")
    body = body.replace("const ", "  ")
    body = body.replace("= [];", "= [];")
    body = body.replace("= {};", "= {};")
    body = body.replace("= null;", "= null;")
    body = body.replace("= false;", "= false;")
    # reconstruct bootstrap properly from original
    original = APP_JS.read_text(encoding="utf-8").splitlines()
    const_lines = []
    state_lines = []
    for line in original[:70]:
        stripped = line.strip()
        if not stripped or stripped.startswith("//"):
            continue
        name = stripped.split("=")[0].replace("let ", "").replace("const ", "").strip()
        if name in CONST_VARS:
            const_lines.append("  " + stripped.replace("const ", "").replace("let ", ""))
        elif name in STATE_VARS or name.startswith("settingsCache"):
            state_lines.append("  " + stripped.replace("let ", "").replace("const ", ""))

    return f"""(function (global) {{
  "use strict";

  global.Syntra = global.Syntra || {{}};

  global.Syntra.constants = {{
{chr(10).join("    " + l for l in const_lines if "API" in l or "TASK_TOOLS" in l or "NOTE_TOOLS" in l or "REMINDER_" in l or "TAB_" in l or "DEFAULT_" in l or "ALERT_" in l or "VALID_" in l or "THEME_" in l or "SIDEBAR_" in l or "ONBOARDING_" in l or "STANDUP_" in l or "CONFIRM_ICONS" in l)}
  }};

  // Icons assigned after core module loads
  global.Syntra.constants.DELETE_ICON = global.Syntra.constants.DELETE_ICON || "";
  global.Syntra.constants.COPY_ICON = global.Syntra.constants.COPY_ICON || "";

  global.Syntra.state = {{
{chr(10).join("    " + l for l in state_lines)}
  }};
}})(window);
"""


def main() -> None:
    print("Use manual module creation instead.")
    print(f"Source lines: {len(read_lines())}")


if __name__ == "__main__":
    main()
