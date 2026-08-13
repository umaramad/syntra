# Syntra: Task Cards UX + Git Compare Removal — Design

**Date:** 2026-08-13
**Status:** Approved by user (design direction + scope confirmed via brainstorm session)

## Overview

Two changes to Syntra, made together but independently:

1. **Remove the Git Compare module completely** — code, routes, templates, static assets, DB schema, config, and tests.
2. **Redesign the "My Tasks" section** — replace the dense table (with a hidden-double-click edit and a standup panel that expands the table row) with **task cards** whose actions (done, standup, edit, delete) are always visible and whose standup thread lives inside the card.

Hard constraint from the user: **nothing else breaks** — every other feature (notes, team, reminders, MCP console, settings, archive, search, themes, backup, "Today's Standup" summary, stat cards) keeps working exactly as it does today. All existing backend APIs stay unchanged.

## Scope

### In scope

- Delete every Git Compare file and every reference to it (list in Part 1).
- Replace the task table + expanded comments-row UI in the **My Tasks** section with task cards.
- Preserve all existing task behaviors: grouping, collapse state, filters, My Work, search, add/edit/delete, done toggle, standup post/edit/delete, group copy/archive/restore, archive view.

### Out of scope (explicitly unchanged)

- Every other section: Quick Notes, Team Activity, Reminders, MCP Console, Archive, Settings.
- "Today's Standup" summary and the dashboard stat cards.
- Backend APIs (`/api/tasks`, `/api/tasks/:id/comments`, `/api/task-groups`, etc.) — no request/response changes.
- Sidebar, header, profile modal, themes, reminder popups, backup/import.

---

## Part 1 — Git Compare removal

### 1.1 Files to delete

```
git_providers_config.py
controllers/git_compare_controller.py
services/git_compare_service.py
services/git_compare_auth_service.py
services/git_compare_html_service.py
services/git_providers/            (entire directory: base, bitbucket, credentials, github, gitlab, http_client, __init__)
repositories/git_compare_user_repository.py
repositories/git_compare_history_repository.py
models/git_compare_user.py
models/git_compare_history.py
utils/git_compare_debug.py
utils/git_repo_utils.py
static/css/git_compare.css
static/js/git_compare/             (entire directory)
templates/git_compare/             (entire directory)
tests/test_git_compare_logout.py
tests/test_git_compare_service.py
tests/test_git_auth_credentials.py
tests/test_git_repo_utils.py
tests/test_git_providers_config.py
```

### 1.2 References to clean up

| File | Change |
|------|--------|
| `app.py` | Remove `register_git_compare_routes` import + call; remove `configure_logging` import + call (it came from `utils.git_compare_debug`). |
| `config.py` | Remove `GIT_COMPARE_MAX_FILES`, `GIT_COMPARE_MAX_FILE_BYTES`, `GIT_COMPARE_DEBUG`. Replace the `SECRET_KEY` value `"change-me-in-production-syntra-git-compare"` with a neutral dev secret (`"change-me-in-production"`). |
| `database/db.py` | Remove the `git_compare_users` and `git_compare_history` CREATE TABLE + index block from `_migrate_schema`. |
| `templates/index.html` | Remove the "Git Compare" nav link from the sidebar. |
| `README.md` | No changes needed — verified no Git Compare references. |

### 1.3 Database note

`schema.sql` does **not** contain Git Compare tables — they are created only in `db.py::_migrate_schema`, so removing that block fully removes them from the schema. Existing local databases may still contain the orphaned `git_compare_*` tables; they are harmless, unused, and deliberately left in place (dropping user data is out of scope and risky). No migration is written for this.

### 1.4 Verification for removal

- `grep -rni "git_compare\|git-compare\|git_providers\|git_repo_utils\|GitCompare"` (excluding `.venv`, `.git`) returns **zero** matches.
- App boots (`python app.py`) with no import errors.
- All non-Git-Compare tests pass.

---

## Part 2 — My Tasks: card-based task view

### 2.1 What changes

The **My Tasks** section keeps its overall structure (filter bar → collapsible group blocks) but each task is rendered as a **card** instead of a table row. The standup panel, which currently expands a `<tr colspan=7>` below the task row, becomes an **in-card section** that appears when 💬 is clicked.

### 2.2 Approved layout (from brainstorm, "Option A")

**Group block header** (unchanged behavior):
- Collapse chevron + group name + task count
- Group actions: Copy, Archive (active groups); Restore, Delete, Copy (archived groups)

**Task card**:
- Row 1: done circle toggle · task title · status pill · priority pill · action buttons (**💬 count**, **✎ edit**, **🗑 delete**) — always visible, no hover requirement
- Row 2: assignee avatar + name · due date (with existing overdue / due-today styling)
- Done styling: title struck through, muted, checked circle — same visual language as today

**Standup section (in card)**:
- Toggled by the 💬 button; shows the thread (member, status pill, update text, time, delete-per-entry) and the post form (member select, status select, comment input, Post button)
- Same data and endpoints as today's standup panel

**Inline edit (in card)**:
- ✎ opens an edit area inside the card: status select, priority select, assignee select, due date input, **Save** / **Cancel** buttons
- Replaces the current `task-edit-panel` form above the list; same payload as today's edit API
- **Double-click on the card title also opens the inline edit** (kept as a bonus affordance — zero cost, already familiar)

**Add task**:
- The "＋" button in the section header still opens the create form above the list (group, title, assignee, due). No change.

**Filters, My Work, search**:
- Unchanged UI and behavior; rendered task cards reflect the same filtered/sorted set the table showed.

### 2.3 Files to change

| File | Change |
|------|--------|
| `static/js/syntra/tasks.js` | Replace `renderTaskRow` (and its comments-row emission) with a `renderTaskCard` function. Update group-block rendering to emit cards instead of a `<table>`. Reuse existing functions: `toggleTaskComments`, `loadTaskComments`, `renderTaskCommentsList`, `toggleStandupBody`, `addTaskComment`, done-toggle, delete, and the edit submit handler. The ✎ button opens the **in-card edit area** (status/priority/assignee/due + Save/Cancel) and its Save posts the same PUT payload as today's edit form; the old `task-edit-panel` form is removed. Adjust event delegation selectors that target `.editable-row` / `.task-comments-row`. |
| `static/css/style.css` | Add card styles (`.task-card`, action buttons, in-card standup, in-card edit). Keep existing status-pill, done, and due styling. Remove CSS that only served the old task table (`.task-comments-row` layout, table-specific task styles) once they are no longer referenced; keep any class still used elsewhere. |
| `templates/index.html` | No structural change required — cards are rendered by JS. The existing create/edit forms and filters stay. |

### 2.4 What must keep working (regression checklist)

- Group collapse/expand + persisted state (`expandedTaskGroups`)
- Status / priority / assignee filters and "My Work"
- Global search highlighting + render-on-search
- Done toggle (POST `/api/tasks/:id/done`)
- Create task, edit task (PUT), delete task (confirm dialog)
- Standup: open, load, post, edit (dblclick), delete, comment count badge
- Group copy-to-clipboard (HTML + plain text), archive, restore, delete
- Archived groups table in the **Archive** section (separate from My Tasks — untouched)
- Reminder popups, toast, confirm modal, theme switching

### 2.5 Error handling

- All existing `Syntra.core.request` error handling stays: failures surface as toasts; the in-card standup load shows an inline error message (same pattern as today).
- Delete / archive / restore keep their confirm dialogs.
- The create form keeps its validation (required group/title, new-group input).

### 2.6 Testing

- **Automated:** run the full pytest suite before and after (it covers services/repositories; no UI tests exist — unchanged).
- **Manual smoke checklist** (run in browser against `python app.py`):
  1. My Tasks shows groups with cards; collapse/expand works and persists across reload.
  2. Done toggle, edit (✎ and double-click), delete, and add-task all work.
  3. 💬 opens standup thread inside the card; post/edit/delete updates work; count badge updates.
  4. Filters, My Work, and search still filter/highlight cards.
  5. Group copy / archive / restore work; archived group table renders in Archive.
  6. Sidebar no longer shows Git Compare; `/git-compare/*` URLs return 404.
  7. Notes, Team, Reminders, MCP Console, Settings, backup, Today's Standup, stat cards all behave as before.

---

## Success criteria

1. Zero Git Compare references remain in code, config, templates, static assets, or tests; app boots clean.
2. My Tasks is card-based with always-visible actions; standup and edit live in the card.
3. All behaviors listed in §2.4 work identically; pytest passes.
4. No changes to any other section's UI or to any backend API contract.
