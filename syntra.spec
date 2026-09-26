# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec — Syntra native macOS .app bundle.

Produces dist/Syntra.app which is then wrapped into a .dmg by build_deploy.sh.

Key decisions
─────────────────────────────────────────────────────────
• Entry point : app_launcher.py   (pywebview + Flask, NOT app.py)
• GUI         : pywebview cocoa   (native WKWebView — no browser needed)
• console=False so no terminal window opens
• All templates/, static/, database/ are bundled as data
• PyInstaller hook for pywebview is auto-discovered from the venv
─────────────────────────────────────────────────────────
"""

import os
from PyInstaller.utils.hooks import collect_data_files

project_root = os.path.abspath(SPECPATH)   # noqa: F821 – injected by PyInstaller

# ── Bundled data files ─────────────────────────────────────────────────────────
datas = [
    (os.path.join(project_root, "templates"),  "templates"),
    (os.path.join(project_root, "static"),     "static"),
    (os.path.join(project_root, "database"),   "database"),
    (os.path.join(project_root, "config.py"),  "."),
]

# pywebview ships its own JS files that must be bundled
datas += collect_data_files("webview")

# ── Hidden imports ─────────────────────────────────────────────────────────────
# Modules that PyInstaller's static analysis misses
hidden_imports = [
    # Flask stack
    "flask",
    "flask.templating",
    "jinja2",
    "jinja2.ext",
    "werkzeug",
    "werkzeug.serving",
    "werkzeug.debug",
    "click",
    "itsdangerous",
    "blinker",
    # stdlib
    "sqlite3",
    "email.mime.text",
    # Syntra controllers (imported dynamically via register_*_routes)
    "controllers.task_controller",
    "controllers.task_group_controller",
    "controllers.note_controller",
    "controllers.team_controller",
    "controllers.profile_controller",
    "controllers.settings_controller",
    "controllers.backup_controller",
    "controllers.reminder_controller",
    "controllers.mcp_controller",
    # pywebview cocoa backend
    "webview",
    "webview.platforms.cocoa",
    "webview.guilib",
    # PyObjC frameworks required by WKWebView
    "objc",
    "AppKit",
    "Foundation",
    "WebKit",
    "Cocoa",
]

# ── Hook dirs — pick up pywebview's own PyInstaller hook ──────────────────────
# Resolve from the webview package location so it works regardless of
# Python version or venv layout (avoids hardcoding python3.X path).
import webview as _wv
extra_hook_dirs = [
    os.path.join(os.path.dirname(_wv.__file__), "__pyinstaller"),
]

a = Analysis(                                          # noqa: F821
    [os.path.join(project_root, "app_launcher.py")],
    pathex=[project_root],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=extra_hook_dirs,
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter", "matplotlib", "numpy", "pandas", "PIL",
        "PyQt5", "PyQt6", "PySide2", "PySide6",   # we use cocoa, not Qt
    ],
    noarchive=False,
)

pyz = PYZ(a.pure)                                      # noqa: F821

exe = EXE(                                             # noqa: F821
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Syntra",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,       # no terminal — pure native window
    target_arch=None,    # match host arch; use 'universal2' for fat binary
)

coll = COLLECT(                                        # noqa: F821
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name="Syntra",
)

app = BUNDLE(                                          # noqa: F821
    coll,
    name="Syntra.app",
    icon=None,           # build_deploy.sh injects a .icns if sips is available
    bundle_identifier="com.syntra.app",
    info_plist={
        # Identity
        "CFBundleName":               "Syntra",
        "CFBundleDisplayName":        "Syntra",
        "CFBundleVersion":            "1.0.0",
        "CFBundleShortVersionString": "1.0.0",
        "CFBundleIdentifier":         "com.syntra.app",
        # UI
        "NSHighResolutionCapable":    True,
        "NSSupportsAutomaticGraphicsSwitching": True,
        "LSUIElement":                False,    # show in Dock + App Switcher
        "LSMinimumSystemVersion":     "11.0",   # Big Sur+ (WKWebView stable)
        # Networking — allow localhost connections
        "NSAppTransportSecurity": {
            "NSAllowsLocalNetworking":       True,
            "NSAllowsArbitraryLoads":        False,
        },
        # Privacy (no microphone/camera needed)
        "NSMicrophoneUsageDescription": "",
        "NSCameraUsageDescription":     "",
    },
)
