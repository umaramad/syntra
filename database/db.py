"""SQLite database access layer.

Connection management is isolated here so the storage backend can be swapped
later by replacing get_connection() and the helpers that depend on it.
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Optional

import config

SCHEMA_PATH = Path(__file__).parent / "schema.sql"

DEFAULT_MCP_TOOLS: tuple[dict[str, str], ...] = (
    {
        "name": "Create Task",
        "tool_key": "create_task",
        "description": "Create a new task with a title and optional description.",
        "keywords": "create,add,new,task,todo,reminder,work",
        "patterns": "create task,add task,new task,remind me",
    },
    {
        "name": "Create Note",
        "tool_key": "create_note",
        "description": "Create a new note with a title and optional content.",
        "keywords": "create,add,new,note,notes,write,save",
        "patterns": "create note,add note,new note,write note",
    },
    {
        "name": "List Tasks",
        "tool_key": "list_tasks",
        "description": "List all tasks, optionally filtered by status.",
        "keywords": "show,list,view,tasks,pending,completed",
        "patterns": "show tasks,list tasks,my tasks",
    },
    {
        "name": "List Notes",
        "tool_key": "list_notes",
        "description": "List all notes.",
        "keywords": "show,list,view,notes",
        "patterns": "show notes,list notes,my notes",
    },
    {
        "name": "Assign Task",
        "tool_key": "assign_task",
        "description": "Assign a task to a team member.",
        "keywords": "assign,task,member,user,team",
        "patterns": "assign task,assign to,give task",
    },
)


def get_connection() -> sqlite3.Connection:
    """Open and return a configured SQLite connection."""
    conn = sqlite3.connect(config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    """Yield a connection within a transaction; commit on success, rollback on error."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def row_to_dict(row: Optional[sqlite3.Row]) -> Optional[dict[str, Any]]:
    """Convert a sqlite3.Row to a plain dictionary."""
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


def _execute_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def seed_default_tools(conn: Optional[sqlite3.Connection] = None) -> None:
    """Insert default MCP tools when they are not already stored."""
    if conn is not None:
        _insert_default_tools(conn)
        return

    with get_db() as connection:
        _insert_default_tools(connection)


def _insert_default_tools(conn: sqlite3.Connection) -> None:
    for tool in DEFAULT_MCP_TOOLS:
        exists = conn.execute(
            "SELECT 1 FROM mcp_tools WHERE tool_key = ?",
            (tool["tool_key"],),
        ).fetchone()
        if exists:
            continue

        conn.execute(
            """
            INSERT INTO mcp_tools (name, tool_key, description, keywords, patterns, enabled)
            VALUES (?, ?, ?, ?, ?, 1)
            """,
            (
                tool["name"],
                tool["tool_key"],
                tool["description"],
                tool["keywords"],
                tool["patterns"],
            ),
        )


def _migrate_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS task_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    columns = {
        row[1] for row in conn.execute("PRAGMA table_info(tasks)").fetchall()
    }
    if "group_id" not in columns:
        conn.execute(
            "ALTER TABLE tasks ADD COLUMN group_id INTEGER REFERENCES task_groups(id)"
        )

    default_group = conn.execute(
        "SELECT id FROM task_groups WHERE name = ?",
        ("General",),
    ).fetchone()
    if not default_group:
        cursor = conn.execute(
            "INSERT INTO task_groups (name) VALUES (?)",
            ("General",),
        )
        default_group_id = cursor.lastrowid
    else:
        default_group_id = default_group["id"]

    conn.execute(
        "UPDATE tasks SET group_id = ? WHERE group_id IS NULL",
        (default_group_id,),
    )

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks(group_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_task_groups_name ON task_groups(name)"
    )

    group_columns = {
        row[1] for row in conn.execute("PRAGMA table_info(task_groups)").fetchall()
    }
    if "archived" not in group_columns:
        conn.execute(
            "ALTER TABLE task_groups ADD COLUMN archived INTEGER DEFAULT 0"
        )

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_task_groups_archived ON task_groups(archived)"
    )

    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS task_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            comment TEXT NOT NULL,
            author_name TEXT DEFAULT 'User',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id)"
    )

    comment_columns = {
        row[1] for row in conn.execute("PRAGMA table_info(task_comments)").fetchall()
    }
    if "status" not in comment_columns:
        conn.execute(
            "ALTER TABLE task_comments ADD COLUMN status TEXT DEFAULT 'in_progress'"
        )
    if "assigned_to" not in comment_columns:
        conn.execute(
            "ALTER TABLE task_comments ADD COLUMN assigned_to INTEGER REFERENCES team_members(id)"
        )

    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            display_name TEXT NOT NULL DEFAULT 'User',
            email TEXT,
            role TEXT,
            team_member_id INTEGER,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_member_id) REFERENCES team_members(id)
        );
        """
    )


def init_db() -> None:
    """Create schema, migrate, and seed default MCP tools."""
    with get_db() as conn:
        _execute_schema(conn)
        _migrate_schema(conn)
        _insert_default_tools(conn)
