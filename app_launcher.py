"""
Syntra — native window launcher.

Architecture
─────────────────────────────────────────────────────────
  Thread A (main)  : pywebview event loop → WKWebView window
  Thread B         : Flask dev server (localhost only)

pywebview uses macOS WKWebView (same engine as Safari) so the
app opens as a real native window with no browser chrome, no
URL bar, and a proper Dock icon.

This file is ONLY used by PyInstaller / the .dmg build.
app.py (the normal dev server) is completely unchanged.
─────────────────────────────────────────────────────────
"""
from __future__ import annotations

import os
import sys
import socket
import threading
import time

# ── Paths ──────────────────────────────────────────────────────────────────────
def _resource_base() -> str:
    """Root of bundled resources (or project root in dev mode)."""
    return getattr(sys, "_MEIPASS", os.path.abspath(os.path.dirname(__file__)))


def _data_dir() -> str:
    """
    Writable directory for the SQLite database.
    Bundled app  → ~/Library/Application Support/Syntra  (survives updates)
    Dev run      → project root  (same as always)
    """
    if getattr(sys, "frozen", False):
        path = os.path.expanduser("~/Library/Application Support/Syntra")
        os.makedirs(path, exist_ok=True)
        return path
    return os.path.abspath(os.path.dirname(__file__))


# ── Environment setup — must happen before any app import ──────────────────────
os.chdir(_resource_base())                         # Flask finds templates/static here
os.environ.setdefault("SYNTRA_DB_PATH",
                      os.path.join(_data_dir(), "syntra.db"))
os.environ.setdefault("SYNTRA_DEBUG",      "false")
os.environ.setdefault("SYNTRA_SECRET_KEY", "syntra-native-secret")

# ── Port selection: use a free port so we never clash ──────────────────────────
def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


PORT = int(os.environ.get("APP_PORT", 0)) or _free_port()
URL  = f"http://127.0.0.1:{PORT}"

# ── Window dimensions (restores to a comfortable default) ─────────────────────
WIN_W = 1280
WIN_H = 800
WIN_MIN_W = 900
WIN_MIN_H = 600


# ── Flask server thread ────────────────────────────────────────────────────────
def _run_flask() -> None:
    """Start Flask on the loopback interface. Runs forever in the background."""
    from app import app as flask_app          # lazy — env vars already set above

    flask_app.run(
        host="127.0.0.1",
        port=PORT,
        debug=False,
        use_reloader=False,
        threaded=True,
    )


def _wait_for_flask(timeout: float = 15.0) -> bool:
    """Poll until Flask is accepting connections or we time out."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", PORT), timeout=0.3):
                return True
        except OSError:
            time.sleep(0.1)
    return False


# ── Window ready callback ──────────────────────────────────────────────────────
def _on_window_created(window) -> None:
    """
    Called by pywebview after the native window exists but before it is shown.
    We wait for Flask here (off the main thread) then load the URL.
    """
    def _load():
        ready = _wait_for_flask()
        if ready:
            window.load_url(URL)
        else:
            # Show a friendly error inside the window
            window.load_html(
                "<html><body style='font-family:sans-serif;padding:2rem;'>"
                "<h2>Syntra failed to start</h2>"
                "<p>Flask did not respond within 15 seconds.</p>"
                "</body></html>"
            )
    threading.Thread(target=_load, daemon=True).start()


# ── Main entry point ───────────────────────────────────────────────────────────
def main() -> None:
    import webview  # imported late so env vars are set first

    # 1. Start Flask in a daemon thread (dies automatically when window closes)
    flask_thread = threading.Thread(target=_run_flask, name="flask", daemon=True)
    flask_thread.start()

    # 2. Create the native window — starts blank, _on_window_created loads URL
    window = webview.create_window(
        title="Syntra",
        url="about:blank",           # replaced in _on_window_created
        width=WIN_W,
        height=WIN_H,
        min_size=(WIN_MIN_W, WIN_MIN_H),
        resizable=True,
        text_select=False,           # disable text selection highlight
        confirm_close=False,         # no "are you sure?" dialog
        background_color="#f4f5f9",  # matches --bg in style.css (no flash)
        frameless=False,             # keep standard macOS title bar / traffic lights
        easy_drag=False,
    )

    # 3. Hand off to pywebview's Cocoa event loop (blocks until window closes)
    webview.start(
        func=_on_window_created,
        args=[window],
        gui="cocoa",                 # native WKWebView on macOS
        debug=False,                 # set True to attach Safari Web Inspector
        private_mode=False,          # allow localStorage / cookies
    )

    # Window closed → process exits
    sys.exit(0)


if __name__ == "__main__":
    main()
