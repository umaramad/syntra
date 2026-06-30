"""Export and import workspace data as portable JSON backups."""

from typing import Any

import config
from database.db import get_db, row_to_dict
from utils.datetime_utils import utc_now_str

BACKUP_FORMAT = "syntra-backup"
BACKUP_VERSION = 1

BACKUP_TABLES: tuple[str, ...] = (
    "team_members",
    "task_groups",
    "tasks",
    "task_comments",
    "notes",
    "reminders",
    "mcp_tools",
    "tool_execution_logs",
    "user_profile",
    "user_settings",
)

_AUTOINCREMENT_TABLES: tuple[str, ...] = (
    "team_members",
    "task_groups",
    "tasks",
    "task_comments",
    "notes",
    "reminders",
    "mcp_tools",
    "tool_execution_logs",
)


class BackupService:
    def export_backup(self) -> dict[str, Any]:
        tables: dict[str, list[dict[str, Any]]] = {}

        with get_db() as conn:
            for table_name in BACKUP_TABLES:
                rows = conn.execute(f"SELECT * FROM {table_name}").fetchall()
                tables[table_name] = [row_to_dict(row) for row in rows]

        return {
            "format": BACKUP_FORMAT,
            "version": BACKUP_VERSION,
            "app": config.APP_NAME,
            "exported_at": utc_now_str(),
            "tables": tables,
        }

    def import_backup(self, payload: Any) -> dict[str, Any]:
        tables = self._validate_backup(payload)

        with get_db() as conn:
            conn.execute("PRAGMA foreign_keys = OFF")
            try:
                for table_name in BACKUP_TABLES:
                    conn.execute(f"DELETE FROM {table_name}")

                imported_counts: dict[str, int] = {}
                for table_name in BACKUP_TABLES:
                    rows = tables[table_name]
                    imported_counts[table_name] = self._insert_rows(conn, table_name, rows)

                self._sync_autoincrement_sequences(conn)
            finally:
                conn.execute("PRAGMA foreign_keys = ON")

        return {
            "imported_at": utc_now_str(),
            "tables": imported_counts,
        }

    def _validate_backup(self, payload: Any) -> dict[str, list[dict[str, Any]]]:
        if not isinstance(payload, dict):
            raise ValueError("Backup must be a JSON object")

        if payload.get("format") != BACKUP_FORMAT:
            raise ValueError(f"Unsupported backup format. Expected '{BACKUP_FORMAT}'")

        version = payload.get("version")
        if version != BACKUP_VERSION:
            raise ValueError(f"Unsupported backup version: {version}")

        raw_tables = payload.get("tables")
        if not isinstance(raw_tables, dict):
            raise ValueError("Backup is missing tables data")

        normalized: dict[str, list[dict[str, Any]]] = {}
        for table_name in BACKUP_TABLES:
            rows = raw_tables.get(table_name, [])
            if rows is None:
                rows = []
            if not isinstance(rows, list):
                raise ValueError(f"Invalid table data for '{table_name}'")
            for index, row in enumerate(rows):
                if not isinstance(row, dict):
                    raise ValueError(
                        f"Invalid row in '{table_name}' at index {index}: expected an object"
                    )
            normalized[table_name] = rows

        return normalized

    def _insert_rows(
        self, conn, table_name: str, rows: list[dict[str, Any]]
    ) -> int:
        if not rows:
            return 0

        table_columns = [
            row[1]
            for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()
        ]
        if not table_columns:
            return 0

        placeholders = ", ".join("?" for _ in table_columns)
        column_list = ", ".join(table_columns)
        sql = f"INSERT INTO {table_name} ({column_list}) VALUES ({placeholders})"

        for row in rows:
            conn.execute(sql, [row.get(column) for column in table_columns])

        return len(rows)

    def _sync_autoincrement_sequences(self, conn) -> None:
        for table_name in _AUTOINCREMENT_TABLES:
            row = conn.execute(f"SELECT MAX(id) AS max_id FROM {table_name}").fetchone()
            max_id = row["max_id"] if row else None
            if max_id is None:
                conn.execute("DELETE FROM sqlite_sequence WHERE name = ?", (table_name,))
                continue

            existing = conn.execute(
                "SELECT 1 FROM sqlite_sequence WHERE name = ?",
                (table_name,),
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE sqlite_sequence SET seq = ? WHERE name = ?",
                    (max_id, table_name),
                )
            else:
                conn.execute(
                    "INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)",
                    (table_name, max_id),
                )
