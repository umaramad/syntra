# Dashboard Weekly Team Leave View

**Date:** 2026-10-15
**Status:** Design approved by user

## Goal

Give the user a quick way to see planned team leave for the current week from the dashboard, without changing the existing team availability or leave-management workflows.

## User experience

- Add a compact dashboard section that summarizes planned leave for the current week and provides a **View** action.
- Activating **View** opens a modal and keeps the user on the dashboard.
- The modal displays Monday through Sunday in chronological day groups. Each plan appears on every day it covers, with the member name and optional details.
- Highlight the current day. If there are no plans for the week, show a clear empty state.
- Close the modal with its close button, Escape, or a click outside the dialog. Keep the dialog usable on narrow screens.

## Data and date behavior

- Reuse the existing team member and leave-plan caches; do not add routes or change API shapes.
- Compute the current local calendar week, Monday through Sunday, and include any plan whose date range overlaps that week.
- Render each plan for dates satisfying `start_date <= day <= end_date`; dates are existing `YYYY-MM-DD` local-date strings.
- Escape member names and leave details with the project's existing HTML escaping helper.
- When the dashboard's cached data refreshes, update the summary and modal content from that data.

## Scope and compatibility

- Add only the dashboard entry point and weekly modal view.
- Preserve existing leave creation, editing, deletion, team availability tabs, dashboard stat cards, and API contracts.
- Do not add week navigation or leave filtering in this change; the view always represents the current week.

## Validation

- Extend the JavaScript smoke checks for Monday-first week boundaries, overlapping leave ranges, and plans outside the week.
- Run the existing JavaScript smoke script and relevant Python test suite to catch regressions in dashboard/bootstrap integration and leave behavior.
- Manually check the empty and populated modal states, keyboard dismissal, and narrow-screen layout if a browser run is available.