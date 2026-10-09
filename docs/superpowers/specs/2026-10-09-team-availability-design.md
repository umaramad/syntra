# Syntra: Team Availability & Leave Plans — Design

**Date:** 2026-10-09
**Status:** Approved by user (design direction + scope confirmed via brainstorm session)

## Overview

Add leave tracking to the Team area so the user can see who is away and who is available:

1. **Per-member config menu** — a ⚙ button on each Team Activity row opens a dropdown of actions, the first being "Leave plan…" to enter a leave plan (date range + free-text details), plus "Manage leaves…" (edit/cancel existing entries), Edit, and Delete.
2. **Availability panel** — a second tab inside the Team view (next to "Team Activity") with two modes: **Today** (two lists: on leave vs available) and **Month** (calendar grid with initials on days away; click a date to drill into that day's lists).

Hard constraint from the user: **nothing else breaks** — the member list, double-click-to-edit, add-member flow, search, dashboards, backup, and all existing API contracts keep working.

## Scope

### In scope

- New `leave_plans` table + `/api/leave-plans` resource (controller → service → repository, matching the team stack).
- Gear-icon action menu per team member row, consolidating existing Edit/Delete plus two new leave actions.
- Leave plan form (create + edit) and per-member leave management list.
- Team view tab switcher: `Team Activity` | `Availability`.
- Today view and Month view (grid + per-day drill-down) derived client-side from cached data.
- `leave_plans` included in workspace export/import backup.
- Backend tests (pytest) and JS smoke coverage for the new module and its date helpers.

### Out of scope (explicitly unchanged / deferred)

- Leave types/categories (vacation, sick, …) — free-text details only.
- Leave approval workflow, permissions, multi-user auth (app is a single-user workspace).
- Public-holiday or weekend logic — "available" means simply "not on leave today".
- Notifications or dashboard stat-card changes.
- Filtering the availability views by the global search box (availability always shows all members).
- Any change to existing API request/response shapes.

## Data model

```sql
CREATE TABLE IF NOT EXISTS leave_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_member_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,          -- YYYY-MM-DD
    end_date TEXT NOT NULL,            -- YYYY-MM-DD, always >= start_date
    details TEXT,                      -- optional free text, <= 500 chars
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_leave_plans_member ON leave_plans(team_member_id);
CREATE INDEX IF NOT EXISTS idx_leave_plans_dates ON leave_plans(start_date, end_date);
```

Decisions:

- **Dates are `YYYY-MM-DD` strings.** SQLite and JS both compare them lexicographically, so "is X away on day D" is `start_date <= D AND D <= end_date` with no date parsing. Dates are the **browser's local calendar date** (reuse `SyntraDateTime.localDateString`); no timezone conversion anywhere.
- **Single-day leave** is `start_date == end_date` — no special case.
- **`ON DELETE CASCADE`**: leave belongs to the member, so deleting a member auto-removes their plans. This composes with the existing `TeamRepository.delete` fix (which nulls other FKs) without touching it, and no orphan rows can trigger FK errors.
- **Overlapping plans are allowed** (no uniqueness constraint) — the app does not arbitrate double-booking; the Month view simply shows all names for a day.

## API contract

Base route registered in `app.py` alongside the others. Service raises `ValueError` on bad input (controller converts to `400`), matching the team routes exactly.

| Route | Body / query | Success | Errors |
|---|---|---|---|
| `GET /api/leave-plans` | optional `?member_id=<int>` | `200` `[leavePlan, …]` ordered by `start_date DESC, id DESC` | — |
| `POST /api/leave-plans` | `{team_member_id, start_date, end_date, details?}` | `201` single `leavePlan` | `400 {error}` |
| `PUT /api/leave-plans/<id>` | any subset of `{team_member_id, start_date, end_date, details}` | `200` updated `leavePlan` | `400 {error}`, `404 {error}` |
| `DELETE /api/leave-plans/<id>` | — | `200 {success: true}` | `404 {error}` |

`leavePlan` shape (repository selects join `team_members` for the name):

```json
{
  "id": 3,
  "team_member_id": 1,
  "member_name": "Alex",
  "start_date": "2026-10-12",
  "end_date": "2026-10-14",
  "details": "Family trip",
  "created_at": "2026-10-09 10:12:00",
  "updated_at": "2026-10-09 10:12:00"
}
```

Validation (service layer, all → `400 {"error": …}`):

- `team_member_id` required and must exist (`TeamRepository.find_by_id`).
- `start_date` / `end_date` required, valid `YYYY-MM-DD` calendar dates, `start_date <= end_date`.
- `details` optional; empty string stored as `NULL`; max 500 characters.
- `PUT` validates only the fields supplied; `id` missing from the table → `404`.

## UI design

### Tab switcher

The `team-activity` view panel gains a segmented control at the top — `Team Activity` | `Availability` — styled like the existing task filter chips (`task-filter-chip`), with `aria-pressed`. Default: **Team Activity**. Switching toggles which section is visible (both live inside the existing `data-view="team-activity"` panel; sidebar entry stays "Team").

### Config menu (gear button)

`renderTeamFromCache()`'s actions cell renders a ⚙ `row-config-btn` in place of today's standalone delete button (double-click-to-edit on the row is untouched). Clicking opens one reusable absolutely-positioned popover, one open at a time, closed by outside-click or `Escape`:

1. **Leave plan…** — opens the leave form with that member preselected
2. **Manage leaves…** — opens that member's leave list
3. **Edit** — opens the existing `team-edit-panel` (same as double-click)
4. **Delete** — existing `deleteResource()` confirm flow

Menu items are plain buttons with `data-action` and `data-id`; wiring lives in the new `availability.js` plus the existing team click binding.

### Leave plan form (`leave-form` create-panel)

Follows the existing `inline-create-form` pattern inside the Team view:

- **Member** — `<select>` of members, prefilled from the gear button (still changeable)
- **From** — `<input type="date">` (required)
- **To** — `<input type="date">` (required, must be `>= From`; UI re-checks on submit)
- **Details** — `<textarea>` (optional, maxlength 500)

Submit → `POST` (or `PUT` in edit mode) → reload leave cache → toast "Leave plan saved". Validation failures toast red via the standard `core.request` error path.

### Manage leaves (`leave-list-panel`)

The selected member's plans, re-sorted client-side from the API's `start_date DESC` order into **upcoming (soonest first), then past (most recent first)** — each row showing `From – To`, details, and Edit / Cancel actions (Cancel uses `confirmDialog` + `DELETE`). Empty state: "No leave plans yet" via `renderEmptyState`.

### Availability panel

- **Mode toggle:** `Today` | `Month` (same segmented control style). Default mode: **Today**; default month: the month containing today.
- **Data:** `Syntra.state.leavePlanCache` loaded in `loadDashboard()`'s `Promise.all` alongside `loadTeam()`. Every view is a pure function of `leavePlanCache` + `teamCache` — tab/mode/month/date changes make **no network requests**. Any leave mutation reloads the cache once.
- **Today view:** two columns — **On leave today** (name, `From – To`, details) and **Available today** (names). A member is on leave when `start_date <= today <= end_date`; available = all members minus those. Also shown for the drill-down below.
- **Month view:** header `‹ October 2026 ›` with prev/next arrows and a **Today** shortcut. A 7-column grid, **Monday-first** (single constant to flip if preferred), each in-month cell showing the day number plus small initials chips for members away that day; out-of-month cells are blank; today's cell is highlighted. Clicking a date renders that date's **On leave / Available** lists directly below the grid (same renderer as the Today view, parameterized by a date string). Leave spanning month boundaries appears in each month it covers.
- Initials are derived from the member name (first letters of up to two words), matching the existing `getTaskInitials` convention.
- Availability views intentionally ignore the global search query; the Team Activity list keeps its current search behavior.

## Data flow

```
loadDashboard()
  └─ Promise.all: …, loadTeam(), GET /api/leave-plans → Syntra.state.leavePlanCache
renderAvailability()
  ├─ onLeaveOn(leaves, date)      pure: filter plans covering `date`
  ├─ availableOn(members, leaves, date)  pure: members − onLeave
  ├─ Today view  = renderAvailability(today)
  ├─ Month grid  = per-day chips from onLeaveOn(leaves, day)
  └─ Drill-down  = renderAvailability(selectedDate)
```

Leave mutations (`create / update / delete`) end with one cache reload, exactly like `loadTeam()` does today.

## Files

**New**

- `controllers/leave_controller.py` — four routes, `ValueError` → `400`
- `services/leave_service.py` — validation + orchestration
- `repositories/leave_repository.py` — SQL + `member_name` join (extends `BaseRepository` where useful)
- `static/js/syntra/availability.js` — `Syntra.availability = { … }`: gear menu, leave form/panel logic, tab + mode switching, day/month rendering, pure date helpers
- `tests/test_leave_service.py` — backend coverage (below)

**Edited**

- `database/schema.sql` — `leave_plans` table + indexes
- `app.py` — register leave routes
- `services/backup_service.py` — add `leave_plans` to exported tables
- `static/js/syntra/bootstrap.js` — `API.leavePlans` constant
- `templates/index.html` — tab switcher, Availability section markup, `leave-form` + `leave-list-panel` panels, `<script>` tag for `availability.js`
- `static/js/syntra/tasks.js` — actions cell renders gear button; team click binding dispatches menu actions (edits stay here)
- `static/css/style.css` — popover menu, tabs, month grid, initials chips — all via theme custom properties so dark mode works
- `scripts/smoke_syntra_js.js` — load `availability.js`, require the `availability` module, assert the pure date helpers

## Error handling

| Case | Behavior |
|---|---|
| Invalid input (dates missing/inverted, unknown member, details > 500) | `400 {error}` → red toast |
| `PUT`/`DELETE` unknown id | `404 {error}` → red toast |
| Member deleted with leave plans | `CASCADE` removes plans; no error, no orphans |
| No members / no leave plans | `renderEmptyState` in the availability panels |
| JS render with empty caches | Renders empty (not-on-leave lists are simply all members) |

## Testing

**Backend — `tests/test_leave_service.py`** (fixtures from `tests/conftest.py`):

- Create: single-day, multi-day, optional details; response includes `member_name`.
- Reject: inverted range, malformed dates, missing dates, nonexistent member, details > 500.
- `GET` returns plans sorted newest-first; `?member_id=` filters.
- `PUT` partial update (change `end_date` only; change `details` only); `404` for unknown id.
- `DELETE` removes one plan; second delete → `404`.
- **Overlapping plans allowed** — two plans covering the same day both persist.
- **Cascade regression** — deleting a team member removes their leave plans (guards the FK fix shipped earlier).
- Route-level tests through Flask's test client: `201`, `400`, `404`, `200` contracts.

**JS — `scripts/smoke_syntra_js.js`:** load `availability.js` in the vm harness, add `availability` to the required modules, and assert the pure helpers: single-day hit, multi-day covering today, day before/after the range misses, month-boundary spanning.

**Manual (browser preview):** enter a leave from a member's gear menu; confirm Today and Month views; drill into a date; edit and cancel a leave; verify dark theme, and that existing team behaviors (add/edit/delete/search/double-click) still work.

## Assumptions (locked during brainstorm)

1. Leave record = **date range + free-text details** (no leave type).
2. Availability lives as a **second tab inside the Team view**.
3. Config menu = **gear button with grouped actions** (Leave plan…, Manage leaves…, Edit, Delete).
4. Month view = **calendar grid with per-date drill-down**; Today view = two lists.
5. Leave management includes **list + edit + delete** in v1.
6. Approach A: dedicated `leave_plans` resource, availability computed client-side.
