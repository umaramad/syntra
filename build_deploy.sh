#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

VENV_DIR="$ROOT_DIR/.venv"
PYTHON="${VENV_DIR}/bin/python"
PIP="${VENV_DIR}/bin/pip"
APP_PORT="${APP_PORT:-8080}"

setup_env() {
  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 not found. Install Python 3.9+ and try again."
    return 1
  fi

  if [[ ! -d "$VENV_DIR" ]]; then
    echo "Creating virtual environment in .venv ..."
    python3 -m venv "$VENV_DIR"
  else
    echo "Using existing virtual environment: .venv"
  fi

  echo "Installing dependencies ..."
  "$PIP" install --upgrade pip
  "$PIP" install -r requirements-dev.txt

  echo ""
  echo "Environment ready."
  echo "  Activate manually: source .venv/bin/activate"
  echo "  Or choose option 2 from this menu to run the app."
}

run_project() {
  if [[ ! -x "$PYTHON" ]]; then
    echo "Virtual environment not found. Run option 1 first."
    return 1
  fi

  echo "Starting Syntra on http://localhost:${APP_PORT}"
  echo "Press Ctrl+C to stop."
  exec "$PYTHON" app.py
}

show_menu() {
  echo ""
  echo "=== Syntra dev menu ==="
  echo "  1) Set up Python environment (.venv + dependencies)"
  echo "  2) Run project (Flask on port ${APP_PORT})"
  echo "  3) Exit"
  echo ""
}

main() {
  while true; do
    show_menu
    read -r -p "Choose an option [1-3]: " choice
    case "$choice" in
      1)
        setup_env
        ;;
      2)
        run_project
        ;;
      3)
        echo "Bye."
        exit 0
        ;;
      *)
        echo "Invalid option. Enter 1, 2, or 3."
        ;;
    esac
  done
}

main "$@"
