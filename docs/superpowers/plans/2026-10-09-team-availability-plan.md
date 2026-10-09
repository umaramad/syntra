# Syntra: Team Availability — Implementation Plan

**Date:** 2026-10-09
**Spec:** [../specs/2026-10-09-team-availability-design.md](../specs/2026-10-09-team-availability-design.md) (approved)
**Ordering:** backend first (testable independently), then frontend plumbing, then view logic, then end-to-end verification. Each step ends with a green check before the next begins.

## Step 1 — Backend resource: `leave_plans`

1. **Schema** — add the `leave_plans` table + the two indexes exactly as in the spec to `database/schema.sql` (`ON DELETE CASCADE` FK to `team_members`).
2. **Repository** — new `repositories/leave_repository.py` extending `BaseRepository`:
   - `create_plan(data) -> LeavePlan`, `find_all(member_id=None)` ordered `start_date DESC, id DESC` with `member_name` from `LEFT JOIN team_members`
   - `find_by_id(id)`, `update_plan(id, fields)` (only allowed keys: `team_member_id`, `start_date`, `end_date`, `details`), `delete_plan(id) -> bool`
   - `touch(id)` sets `updated_at = CURRENT_TIMESTAMP`.
3. **Service** — new `services/leave_service.py` with the spec's validation (member exists; both dates required, valid `YYYY-MM-DD`, `start <= end`; details ≤ 500 → `ValueError` messages suitable for `400 {error}`).
4. **Controller** — new `controllers/leave_controller.py`: `GET/POST /api/leave-plans`, `PUT/DELETE /api/leave-plans/<int:id>`; `ValueError → 400`, missing → `404 {"error": "Leave plan not found"}`.
5. **Wiring** — `app.py` registers `register_leave_routes(app)`; `services/backup_service.py` adds `leave_plans` to both table lists it maintains.
6. **Tests** — `tests/test_leave_service.py` covering every case listed in the spec's Testing section (validation rejections, sort order + `?member_id=` filter, partial update, 404s, overlap-allowed, cascade-on-member-delete regression, Flask test-client status codes).

**Check:** `.venv/bin/python -m pytest tests/ -q` → all green, including pre-existing tests.

## Step 2 — Frontend plumbing

1. `static/js/syntra/bootstrap.js` — add `leavePlans: "/api/leave-plans"` to `API`.
2. `templates/index.html` — inside `data-view="team-activity"`:
   - segmented tab switcher `Team Activity | Availability` above the sections
   - new Availability section markup: mode toggle `Today | Month`, month header (`‹ month ›` + Today button), grid container, drill-down container
   - new create-panels `leave-form` (member select, From/To dates, details textarea) and `leave-list-panel`
   - `<script src="/static/js/syntra/availability.js">` **before** `app.js`
3. `static/js/syntra/availability.js` — module skeleton in the existing IIFE style: `Syntra.availability = { … }` with `initAvailability()` called from `initApp()` in `static/js/syntra/app.js`.
4. `static/js/syntra/tasks.js` — `renderTeamFromCache` actions cell: ⚙ `row-config-btn` replaces the standalone delete button; menu-action dispatch added to the team list click binding (Edit/Delete keep their existing handlers).
5. `static/css/style.css` — popover menu, tab switcher, month grid, initials chips — all via theme custom properties (verify both themes).
6. `scripts/smoke_syntra_js.js` — add `syntra/availability.js` to `scripts`, `availability` to `required`.

**Check:** `node scripts/smoke_syntra_js.js` → `OK` line; `.venv/bin/python -m pytest tests/ -q` still green.

## Step 3 — Availability view logic (availability.js)

1. **Cache** — `loadDashboard()`'s `Promise.all` also fetches `GET /api/leave-plans` → `Syntra.state.leavePlanCache` (add the field in `bootstrap.js` state).
2. **Pure helpers** — `onLeaveOn(leaves, date)` and `availableOn(members, leaves, date)` using lexicographic `YYYY-MM-DD` comparisons; `initialsFor(name)`.
3. **Today view** — two columns (On leave today / Available today) via one date-parameterized renderer.
4. **Month view** — Monday-first grid for the selected month, day cells with initials chips, today highlighted, `‹ ›` navigation + Today shortcut, click-a-date → drill-down below using the same renderer.
5. **Gear menu** — open/close/outside-click/Escape behavior; items dispatch to: open `leave-form` (member preselected), open `leave-list-panel`, open `team-edit-panel`, existing delete flow.
6. **Leave form** — create + edit modes; client mirror of validation (`end >= start`, required dates, ≤500 chars); on success reload `leavePlanCache` + toast.
7. **Manage panel** — member's plans re-sorted upcoming-then-past; Edit refills the form; Cancel uses `confirmDialog` → `DELETE` → reload cache.

**Check:** smoke script asserts the pure date helpers (single-day hit, multi-day covering today, day before/after miss, month-boundary span); pytest still green.

## Step 4 — End-to-end verification (browser)

Run the app (reuse the user's dev server if already listening on 8080; otherwise start one from `.venv` and note the port), open the preview, and verify:

1. Gear menu opens/closes correctly; Edit and Delete still behave as before; double-click-to-edit intact.
2. Enter a leave (multi-day) → appears in Manage leaves; Today view splits members correctly on a date inside vs outside the range.
3. Month view shows initials on the right days; clicking a date drills down; prev/next month and Today work.
4. Edit and cancel a leave; cache updates without full reload errors.
5. Delete a member with leave plans → no error (cascade), views update.
6. Dark + light themes render the new UI correctly; Team Activity search still filters only the member list.
7. Console has no errors; all requests return expected codes.

**Check:** full pytest suite green, smoke script OK, manual pass complete — then report to the user with what was verified.

## Out of scope (do not do)

Leave types, approvals, permissions, holidays/weekend logic, notifications, dashboard stat changes, search-filtering availability, changes to existing API contracts.
