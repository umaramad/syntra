# Task Edit Modal and Comment Form Styling

**Date:** 2026-10-15
**Status:** Superseded by `2026-10-15-task-title-comment-modal-design.md`

## Goal

Make task editing a focused modal interaction and ensure the standup comment form controls use the application's form styling.

## Task editing

- Both double-clicking a task card and activating its pencil button open the same task edit modal.
- Preserve the current editable fields: status, priority, assignee, and due date. Do not expand task edit scope to title or description.
- Save submits the existing task update payload and refresh behavior; Cancel, Escape, or clicking the backdrop closes without saving.
- The modal focuses its first interactive field when opened and returns focus to the initiating element when closed.
- Remove the inline task-card editor so no alternate edit surface remains.

## Comment form styling

- Style the team member selector, status selector, comment textbox, and Post button in each task's comment form using the existing theme variables and form control conventions.
- Keep the controls readable in light and dark themes and adapt the layout on narrow screens without changing submission behavior.

## Compatibility and validation

- Keep the task and comment API contracts unchanged.
- Preserve task-card actions, double-click-to-edit semantics, comment creation, and comment-row editing/deletion.
- Run the JavaScript smoke script and Python tests; verify modal open/save/cancel/dismissal and comment controls in the browser at desktop and mobile widths.