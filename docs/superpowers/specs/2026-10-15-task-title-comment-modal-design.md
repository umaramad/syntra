# Task Title and Comment Edit Modals

**Date:** 2026-10-15
**Status:** Implemented

## Scope

- Add task name to the existing task edit modal. Preserve status, priority, assignee, due date, validation, and the current PUT API.
- Replace inline standup-comment editing with a modal containing the existing team member, status, and comment fields.
- Save with the existing task-comment PUT API. Cancel, Escape, and backdrop close without saving; restore focus to the originating task/comment row when possible.
- Style member and status selects in the standup add/edit forms with consistent dimensions, themed border/background/focus styles, and a visible dropdown indicator. Preserve native select behavior and option sets.
- Do not change comment creation, deletion, task APIs, or backend behavior.

## Validation

- Run JavaScript smoke checks and the Python test suite.
- Verify task name editing, standup-comment editing, modal dismissal/focus behavior, and dropdown styling in the browser at desktop and mobile widths.