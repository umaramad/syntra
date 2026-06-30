<p align="center">
  <img src="static/images/syntra-logo.svg" alt="Syntra" width="280">
</p>

<p align="center">
  <strong>A lightweight workspace for tasks, standups, notes, team, and reminders.</strong><br>
  Built with Flask, SQLite, and vanilla HTML/CSS/JavaScript — no frontend framework required.
</p>

<p align="center">
  <img src="static/images/syntra-mark.svg" alt="Syntra mark" width="48">
</p>

---

## Overview

**Syntra** is a single-page productivity dashboard for day-to-day team work. Manage grouped tasks, capture standup updates, jot notes, track team members, set reminders, and run natural-language commands through a built-in **MCP-style tool layer** — all backed by a clean **MVC + Service + Repository** architecture.

---

## Features

### Dashboard & navigation
- **Stat cards** — total tasks, completed, due today, overdue, and team member count
- **Collapsible sidebar** — icon-only mode with persisted preference
- **Global search** — filter tasks, notes, and team members from the header
- **Section-based layout** — expand/collapse My Tasks, Notes, Team, Reminders, Archive, MCP Console, and Settings

### Tasks & standups
- **Task groups** — organize work by group; create new groups inline
- **Full task fields** — title, status, priority, assignee, due date, and group
- **Quick mark done** — toggle completion from the task row
- **Filters** — status, priority, and assignee (client-side)
- **Overdue & due-today styling** — visual cues on due dates
- **Standup updates** — per-task comment panel with member, status, update text, and timestamp
- **Standup table UI** — scannable layout for daily calls; collapse/expand panel with chevron
- **Double-click to edit** — tasks and standup rows open inline edit panels
- **Group copy to clipboard** — export group tasks + standup data as HTML/plain text for Outlook or Teams

### Notes & team
- **Quick notes** — title and content with double-click edit
- **Team members** — name, role, email, and status

### Reminders
- **Scheduled reminders** — title, datetime, and optional assignee
- **In-app popup alerts** — stacked modal cards (top-right) with snooze (5m / 15m / 1h) and dismiss
- **Opt-in notifications** — reminder popups are **disabled by default**; enable in Settings

### Profile & settings
- **User profile** — display name, email, role, and linked team member (header avatar + modal)
- **Theme switch** — **Light** and **Dark** themes applied instantly across the entire app
- **Reminder toggle** — turn popup polling on or off

### MCP console
- **Natural-language commands** — create/list tasks and notes, assign work
- **Deterministic tool matching** — keyword, pattern, and token scoring (no external LLM)
- **Confidence breakdown** — see why a tool was selected in the UI

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.9+, Flask 3.x |
| Database | SQLite (`sqlite3` stdlib) |
| Frontend | HTML, CSS, vanilla JavaScript |
| Architecture | MVC + Services + Repositories |

---

## Quick start

### Prerequisites

- **Python 3.9+**
- **pip**

### 1. Clone and enter the project

```bash
git clone <your-repo-url>
cd syntra
```

### 2. Create a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the app

```bash
python app.py
```

### 5. Open in your browser

Visit **[http://localhost:8080](http://localhost:8080)**

The SQLite database (`syntra.db`) is created automatically on first run, including schema migrations and default MCP tools.

---

## Configuration

Optional environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SYNTRA_DB_PATH` | `./syntra.db` | SQLite database file path |
| `SYNTRA_SECRET_KEY` | `dev-secret-change-in-production` | Flask secret key |
| `SYNTRA_DEBUG` | `true` | Enable Flask debug mode |

Example:

```bash
export SYNTRA_DB_PATH=/data/syntra.db
export SYNTRA_DEBUG=false
python app.py
```

---

## Architecture

Syntra follows **MVC + Service + Repository** layering:

| Layer | Responsibility |
|-------|----------------|
| **Controllers** | HTTP routing and JSON request/response handling |
| **Services** | Business logic, validation, and orchestration |
| **Repositories** | Data access via SQLite |
| **Models** | Dataclasses representing domain entities |
| **MCP** | Tool registry, matcher, and executable tools |

```
Request → Controller → Service → Repository → SQLite
                              ↓
                         MCP Tools
```

---

## API reference

### Tasks — `/api/tasks`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List tasks (`?status=pending`) |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/:id/done` | Mark task done |
| GET | `/api/tasks/:id/comments` | List standup updates |
| POST | `/api/tasks/:id/comments` | Add standup update |
| PUT | `/api/tasks/:id/comments/:comment_id` | Edit standup update |
| DELETE | `/api/tasks/:id/comments/:comment_id` | Delete standup update |

### Task groups — `/api/task-groups`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/task-groups` | List active groups |
| GET | `/api/task-groups/archived` | List archived groups |
| POST | `/api/task-groups` | Create group |
| POST | `/api/task-groups/:id/archive` | Archive group |
| POST | `/api/task-groups/:id/restore` | Restore archived group |
| DELETE | `/api/task-groups/:id` | Delete archived group |

### Notes — `/api/notes`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notes` | List notes |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Delete note |

### Team — `/api/team`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/team` | List members |
| POST | `/api/team` | Create member |
| PUT | `/api/team/:id` | Update member |
| DELETE | `/api/team/:id` | Delete member |

### Reminders — `/api/reminders`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reminders` | List reminders |
| POST | `/api/reminders` | Create reminder |
| PUT | `/api/reminders/:id` | Update reminder |
| DELETE | `/api/reminders/:id` | Delete reminder |

### Profile — `/api/profile`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Get workspace user profile |
| PUT | `/api/profile` | Update profile |

### Settings — `/api/settings`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Get settings (`theme`, `reminder_notifications_enabled`) |
| PUT | `/api/settings` | Update settings (partial updates supported) |

### MCP — `/api/mcp`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mcp/tools` | List registered tools |
| POST | `/api/mcp/execute` | Execute by tool name or natural-language query |

---

## MCP tools

| Tool | Description |
|------|-------------|
| `create_task` | Create a new task |
| `create_note` | Create a new note |
| `list_tasks` | List all tasks |
| `list_notes` | List all notes |
| `assign_task` | Assign a task to a team member |

**Direct execution:**

```bash
curl -X POST http://localhost:8080/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "create_task", "arguments": {"title": "Ship release"}}'
```

**Natural language query:**

```bash
curl -X POST http://localhost:8080/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{"query": "list tasks"}'
```

### How tool detection works

Syntra does **not** use an LLM or external AI service. The `ToolMatcherService` scores each registered tool using keyword overlap, phrase patterns, and token similarity. The highest-scoring tool above the threshold (default 60%) wins. The same input always produces the same match — predictable and easy to test.

### Try in the MCP Console

| Intent | Example commands |
|--------|------------------|
| Create task | `create task design login page`, `add task call client tomorrow` |
| Create note | `create note meeting discussion`, `write note app idea` |
| List | `show tasks`, `list notes` |
| Assign | `assign task to John` |

---

## Project structure

```
syntra/
├── app.py                      # Application entry point
├── config.py                   # Environment configuration
├── requirements.txt
├── database/
│   ├── db.py                   # Connection, migrations, seeding
│   └── schema.sql              # Database schema
├── models/                     # Domain dataclasses
├── repositories/               # Data access layer
├── services/                   # Business logic
├── controllers/                # HTTP / JSON API routes
├── mcp/                        # Tool registry and implementations
├── utils/                      # Shared helpers (e.g. datetime)
├── static/
│   ├── css/style.css
│   ├── js/app.js               # Dashboard UI logic
│   ├── js/datetime.js          # Client datetime helpers
│   └── images/                 # Logo assets
└── templates/
    └── index.html              # Single-page dashboard
```

---

## Development notes

- **Database** — `syntra.db` is gitignored; each developer gets a local copy on first run.
- **Virtual env** — `.venv/` is gitignored; create your own with `python -m venv .venv`.
- **Themes** — dark mode preference is stored in `user_settings` and cached in `localStorage` for fast load.
- **Reminders** — enable **Settings → Reminder notifications** to activate popup polling.

---

## License

MIT
