# Syntra

A lightweight task, note, and team management app with an MCP-style tool execution layer. Built with Flask, SQLite, and plain HTML/CSS/JavaScript.

## Architecture

Syntra follows **MVC + Service + Repository** layering:

| Layer | Responsibility |
|-------|----------------|
| **Controllers** | HTTP routing and request/response handling (Flask blueprints) |
| **Services** | Business logic and validation |
| **Repositories** | Data access via built-in `sqlite3` |
| **Models** | Plain dataclasses representing domain entities |
| **MCP** | Tool registry and executable tools |

```
Request → Controller → Service → Repository → SQLite
                              ↓
                         MCP Tools
```

## Requirements

- Python 3.9+
- Flask 3.x (only external dependency)

## Setup

```bash
cd syntra
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

## Configuration

Environment variables (all optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `SYNTRA_DB_PATH` | `./syntra.db` | SQLite database file path |
| `SYNTRA_SECRET_KEY` | `dev-secret-change-in-production` | Flask secret key |
| `SYNTRA_DEBUG` | `true` | Enable debug mode |

## API Endpoints

### Tasks — `/api/tasks`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List tasks (`?status=pending`) |
| GET | `/api/tasks/:id` | Get task |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/:id/assign` | Assign task to member |

### Notes — `/api/notes`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notes` | List notes |
| GET | `/api/notes/:id` | Get note |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Delete note |

### Team — `/api/team`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/team` | List members |
| GET | `/api/team/:id` | Get member |
| POST | `/api/team` | Create member |
| PUT | `/api/team/:id` | Update member |
| DELETE | `/api/team/:id` | Delete member |

### MCP — `/api/mcp`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mcp/tools` | List registered tools |
| POST | `/api/mcp/execute` | Execute a tool by name |
| POST | `/api/mcp/query` | Match and execute via natural language |

## MCP Tools

| Tool | Description |
|------|-------------|
| `create_task` | Create a new task |
| `create_note` | Create a new note |
| `list_tasks` | List all tasks |
| `list_notes` | List all notes |
| `assign_task` | Assign a task to a team member |

Example direct execution:

```bash
curl -X POST http://localhost:8080/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "create_task", "arguments": {"title": "Ship release"}}'
```

Example natural language query:

```bash
curl -X POST http://localhost:8080/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{"query": "list tasks"}'
```

## Test Commands

Try these in the **MCP Console** on the dashboard, or via `POST /api/mcp/execute` with a `query` field.

### Create task

- `create task design login page`
- `add task call client tomorrow`
- `remind me to prepare report`

### Create note

- `create note meeting discussion`
- `write note app idea for students`
- `add note project requirements`

### List

- `show tasks`
- `list my tasks`
- `show notes`
- `list notes`

### Assign

- `assign task to John`
- `give task to team member`

### How tool detection works

Syntra does **not** use an LLM or any external AI service to pick tools. Matching is **deterministic**: the `ToolMatcherService` scores each registered tool using keyword overlap, phrase patterns, and token similarity (with fixed weights). The highest-scoring tool above the configured threshold (default 60%) is selected. The same input always produces the same match, confidence score, and reason — making behavior predictable and easy to test.

## Project Structure

```
syntra/
├── app.py                  # Application entry point
├── config.py               # Configuration
├── requirements.txt
├── database/
│   ├── db.py               # Connection management
│   └── schema.sql          # Database schema
├── models/                 # Domain entities
├── repositories/           # Data access layer
├── services/               # Business logic
├── controllers/            # HTTP layer (Flask blueprints)
├── mcp/                    # Tool registry and implementations
├── static/                 # CSS and JavaScript
└── templates/              # HTML templates
```

## License

MIT
