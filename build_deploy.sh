#!/usr/bin/env bash
# =============================================================================
#  Syntra — build & deploy helper
#
#  Option 4 produces a portable .dmg that opens as a native macOS window
#  (WKWebView via pywebview) with no browser required.
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

VENV_DIR="$ROOT_DIR/.venv"
PYTHON="${VENV_DIR}/bin/python"
PIP="${VENV_DIR}/bin/pip"
APP_PORT="${APP_PORT:-8080}"

# ── DMG build settings ────────────────────────────────────────────────────────
APP_NAME="Syntra"
APP_VERSION="1.0.0"
BUNDLE_ID="com.syntra.app"
DIST_DIR="$ROOT_DIR/dist"
BUILD_DIR="$ROOT_DIR/build"
DMG_STAGING="$BUILD_DIR/dmg_staging"
APP_BUNDLE="$DIST_DIR/${APP_NAME}.app"
DMG_OUT="$DIST_DIR/${APP_NAME}-${APP_VERSION}.dmg"
DMG_VOLUME="${APP_NAME} ${APP_VERSION}"
PYINSTALLER="${VENV_DIR}/bin/pyinstaller"

# ── colour helpers ────────────────────────────────────────────────────────────
_green()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
_yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
_red()    { printf '\033[0;31m%s\033[0m\n' "$*"; }
_bold()   { printf '\033[1m%s\033[0m\n'   "$*"; }
_sep()    { printf '%0.s─' {1..60}; printf '\n'; }

# =============================================================================
#  1 — Set up Python environment
# =============================================================================
setup_env() {
  if ! command -v python3 >/dev/null 2>&1; then
    _red "python3 not found. Install Python 3.9+ and try again."
    return 1
  fi

  if [[ ! -d "$VENV_DIR" ]]; then
    echo "Creating virtual environment in .venv ..."
    python3 -m venv "$VENV_DIR"
  else
    echo "Using existing virtual environment: .venv"
  fi

  echo "Installing dependencies ..."
  "$PIP" install --upgrade pip --quiet
  "$PIP" install -r requirements-dev.txt --quiet

  echo ""
  _green "Environment ready."
  echo "  Activate manually:  source .venv/bin/activate"
  echo "  Or choose option 2 to run the app."
}

# =============================================================================
#  2 — Run the dev server
# =============================================================================
run_project() {
  if [[ ! -x "$PYTHON" ]]; then
    _red "Virtual environment not found. Run option 1 first."
    return 1
  fi

  echo "Starting Syntra on http://localhost:${APP_PORT}"
  echo "Press Ctrl+C to stop."
  exec "$PYTHON" app.py
}

# =============================================================================
#  3 — Run tests
# =============================================================================
run_tests() {
  if [[ ! -x "$PYTHON" ]]; then
    _red "Virtual environment not found. Run option 1 first."
    return 1
  fi
  echo "Running test suite ..."
  "${VENV_DIR}/bin/pytest" tests/ -v
}

# =============================================================================
#  4 — Build portable .dmg  (native WKWebView window — no browser needed)
# =============================================================================
build_dmg() {
  _sep
  _bold "Syntra DMG builder — native window edition"
  _sep

  # ── platform guard ──────────────────────────────────────────────────────────
  if [[ "$(uname)" != "Darwin" ]]; then
    _red "DMG packaging requires macOS."
    return 1
  fi

  if [[ ! -x "$PYTHON" ]]; then
    _red "Virtual environment not found. Run option 1 first."
    return 1
  fi

  # ── install build tools into the venv if missing ───────────────────────────
  echo "Checking build dependencies ..."

  if ! "$PYTHON" -c "import PyInstaller" 2>/dev/null; then
    _yellow "  Installing PyInstaller ..."
    "$PIP" install "pyinstaller==6.10.0" --quiet
  else
    echo "  PyInstaller: OK"
  fi

  if ! "$PYTHON" -c "import webview" 2>/dev/null; then
    _yellow "  Installing pywebview (native WKWebView) ..."
    "$PIP" install "pywebview==6.2.1" --quiet
  else
    WEBVIEW_VER=$("$PYTHON" -c "import importlib.metadata; print(importlib.metadata.version('pywebview'))")
    echo "  pywebview ${WEBVIEW_VER}: OK"
  fi

  # ── clean previous artefacts ────────────────────────────────────────────────
  echo ""
  echo "Cleaning previous build artefacts ..."
  rm -rf "$BUILD_DIR" "$DIST_DIR"
  mkdir -p "$BUILD_DIR" "$DIST_DIR"

  # ── Step 1: generate .icns from the Syntra SVG mark ───────────────────────
  echo ""
  _yellow "Step 1/4 — Generating app icon (.icns) ..."
  ICNS_OUT="$BUILD_DIR/${APP_NAME}.icns"
  mkdir -p "$BUILD_DIR"

  if bash "$ROOT_DIR/scripts/make_icns.sh" \
       "$ROOT_DIR/static/images/syntra-mark.svg" \
       "$ICNS_OUT" 2>/dev/null; then
    _green "  ✓ Syntra.icns created"
  else
    _yellow "  Icon generation failed — app will use the default icon."
    ICNS_OUT=""
  fi

  # Inject .icns into the spec's BUNDLE call by passing it via env var
  # (the spec already has icon=None; we'll patch the bundle after build)

  # ── Step 2: PyInstaller bundle ─────────────────────────────────────────────
  echo ""
  _yellow "Step 2/4 — Bundling app with PyInstaller ..."
  echo ""

  "$PYINSTALLER" syntra.spec \
    --distpath "$DIST_DIR" \
    --workpath "$BUILD_DIR/pyinstaller_work" \
    --noconfirm \
    --clean

  if [[ ! -d "$APP_BUNDLE" ]]; then
    _red "PyInstaller did not produce ${APP_NAME}.app — see output above."
    return 1
  fi
  _green "  ✓ ${APP_NAME}.app built at $APP_BUNDLE"

  # Inject .icns if we produced one
  if [[ -n "${ICNS_OUT:-}" && -f "$ICNS_OUT" ]]; then
    local res_dir="${APP_BUNDLE}/Contents/Resources"
    mkdir -p "$res_dir"
    cp "$ICNS_OUT" "${res_dir}/${APP_NAME}.icns"
    /usr/libexec/PlistBuddy -c \
      "Set :CFBundleIconFile ${APP_NAME}" \
      "${APP_BUNDLE}/Contents/Info.plist" 2>/dev/null || \
    /usr/libexec/PlistBuddy -c \
      "Add :CFBundleIconFile string ${APP_NAME}" \
      "${APP_BUNDLE}/Contents/Info.plist" 2>/dev/null || true
    touch "$APP_BUNDLE"   # prompt Finder/Dock to refresh icon cache
    _green "  ✓ Syntra icon injected into app bundle"
  fi

  # ── Step 3: create the DMG ─────────────────────────────────────────────────
  echo ""
  _yellow "Step 3/4 — Creating .dmg with hdiutil ..."
  echo ""

  mkdir -p "$DMG_STAGING"
  cp -R "$APP_BUNDLE" "$DMG_STAGING/"
  # Symlink gives users the familiar "drag to Applications" install
  ln -sf /Applications "$DMG_STAGING/Applications"

  local TMP_DMG="$BUILD_DIR/${APP_NAME}_rw.dmg"

  # Create a writable image from the staging folder
  hdiutil create \
    -srcfolder  "$DMG_STAGING" \
    -volname    "$DMG_VOLUME" \
    -fs         HFS+ \
    -fsargs     "-c c=64,a=16,b=16" \
    -format     UDRW \
    -size       250m \
    "$TMP_DMG" \
    > /dev/null

  # Optional: set a clean background + icon layout via AppleScript
  # (best-effort — skipped silently if it fails)
  _style_dmg() {
    local mnt
    mnt=$(hdiutil attach -readwrite -noverify "$TMP_DMG" 2>/dev/null \
          | grep "/Volumes" | awk '{print $NF}')
    [[ -z "$mnt" ]] && return

    osascript <<APPLESCRIPT 2>/dev/null || true
tell application "Finder"
  tell disk "$DMG_VOLUME"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set bounds of container window to {200, 120, 780, 460}
    set viewOptions to the icon view options of container window
    set arrangement of viewOptions to not arranged
    set icon size of viewOptions to 96
    set position of item "${APP_NAME}.app" of container window to {160, 185}
    set position of item "Applications" of container window to {415, 185}
    close
    open
    update without registering applications
    delay 2
  end tell
end tell
APPLESCRIPT

    hdiutil detach "$mnt" > /dev/null 2>&1 || true
  }
  _style_dmg

  # Convert to final compressed read-only DMG
  hdiutil convert "$TMP_DMG" \
    -format   UDZO \
    -imagekey zlib-level=9 \
    -o        "$DMG_OUT" \
    > /dev/null

  rm -f "$TMP_DMG"
  rm -rf "$DMG_STAGING"

  if [[ ! -f "$DMG_OUT" ]]; then
    _red "DMG creation failed."
    return 1
  fi
  _green "  ✓ DMG created: $DMG_OUT"

  # ── Step 4: summary ────────────────────────────────────────────────────────
  echo ""
  _sep
  _bold "Build complete"
  _sep
  local dmg_size
  dmg_size=$(du -sh "$DMG_OUT" | cut -f1)

  echo "  Output : $DMG_OUT"
  echo "  Size   : $dmg_size"
  echo ""
  _yellow "Step 4/4 — What the user does:"
  echo "  1. Double-click ${APP_NAME}-${APP_VERSION}.dmg"
  echo "  2. Drag ${APP_NAME} → Applications"
  echo "  3. Launch ${APP_NAME} — a native window opens instantly"
  echo "     (no browser, no terminal, no Python install needed)"
  echo ""
  echo "  Data lives in: ~/Library/Application Support/${APP_NAME}/"
  echo ""
  echo "  To open the DMG right now:"
  echo "    open \"$DMG_OUT\""
  _sep
}

# =============================================================================
#  Menu
# =============================================================================
show_menu() {
  echo ""
  _bold "=== Syntra dev menu ==="
  echo "  1) Set up Python environment (.venv + dependencies)"
  echo "  2) Run project  (Flask dev server, port ${APP_PORT})"
  echo "  3) Run tests"
  echo "  4) Build portable .dmg  (native window — macOS only)"
  echo "  5) Exit"
  echo ""
}

main() {
  while true; do
    show_menu
    read -r -p "Choose an option [1-5]: " choice
    case "$choice" in
      1) setup_env   ;;
      2) run_project ;;
      3) run_tests   ;;
      4) build_dmg   ;;
      5) echo "Bye."; exit 0 ;;
      *) _red "Invalid option. Enter 1–5." ;;
    esac
  done
}

main "$@"
