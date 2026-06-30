(function (global) {
  "use strict";
  const Syntra = global.Syntra;
  const {
    formatDateTime,
    toLocalDateTimeValue,
    formatDateInput,
    isToday,
    isOverdue,
    nowFormatted,
    parseStoredDateTime,
    localDateString,
  } = global.SyntraDateTime;

function taskMatchesSearch(task, query) {
  if (!query) return true;
  const fields = [
    task.title,
    task.group_name,
    task.assignee_name,
    task.priority,
    task.status,
    task.description,
  ];
  if (fields.some((field) => String(field || "").toLowerCase().includes(query))) {
    return true;
  }
  const comments = Syntra.state.taskCommentsCache[task.id] || [];
  return comments.some((entry) =>
    [entry.comment, entry.assignee_name, entry.status, entry.author_name]
      .some((field) => String(field || "").toLowerCase().includes(query))
  );
}

function noteMatchesSearch(note, query) {
  if (!query) return true;
  return [note.title, note.content]
    .some((field) => String(field || "").toLowerCase().includes(query));
}

function memberMatchesSearch(member, query) {
  if (!query) return true;
  return [member.name, member.role, member.email, member.status]
    .some((field) => String(field || "").toLowerCase().includes(query));
}

function getFilteredTasks() {
  let tasks = [...Syntra.state.taskCache];

  if (Syntra.state.taskFilters.status) {
    tasks = tasks.filter((task) => task.status === Syntra.state.taskFilters.status);
  }

  if (Syntra.state.taskFilters.priority === "high_plus") {
    tasks = tasks.filter((task) => task.priority === "high" || task.priority === "urgent");
  } else if (Syntra.state.taskFilters.priority) {
    tasks = tasks.filter((task) => task.priority === Syntra.state.taskFilters.priority);
  }

  if (Syntra.state.taskFilters.assignee === "unassigned") {
    tasks = tasks.filter((task) => !task.assigned_to);
  } else if (Syntra.state.taskFilters.assignee) {
    tasks = tasks.filter((task) => String(task.assigned_to) === Syntra.state.taskFilters.assignee);
  }

  const query = Syntra.core.normalizeSearchQuery(Syntra.state.searchQuery);
  if (query) {
    tasks = tasks.filter((task) => taskMatchesSearch(task, query));
  }

  return tasks;
}

function getFilteredNotes() {
  const query = Syntra.core.normalizeSearchQuery(Syntra.state.searchQuery);
  if (!query) return Syntra.state.noteCache;
  return Syntra.state.noteCache.filter((note) => noteMatchesSearch(note, query));
}

function getFilteredTeam() {
  const query = Syntra.core.normalizeSearchQuery(Syntra.state.searchQuery);
  if (!query) return Syntra.state.teamCache;
  return Syntra.state.teamCache.filter((member) => memberMatchesSearch(member, query));
}

function renderDueDateCell(task) {
  if (!task.due_date) return "—";
  const dateText = formatDateInput(task.due_date);
  let className = "due-date";
  if (task.status !== "done" && task.status !== "cancelled") {
    if (isOverdue(task.due_date)) className += " due-overdue";
    else if (isToday(task.due_date)) className += " due-today";
  }
  return `<span class="${className}">${Syntra.core.escapeHtml(dateText)}</span>`;
}

function scrollToFirstSearchMatch() {
  const query = Syntra.core.normalizeSearchQuery(Syntra.state.searchQuery);
  if (!query) return;

  const sections = [
    { id: "my-tasks", hasMatch: getFilteredTasks().length > 0 },
    { id: "quick-notes", hasMatch: getFilteredNotes().length > 0 },
    { id: "team-activity", hasMatch: getFilteredTeam().length > 0 },
  ];
  const firstMatch = sections.find((section) => section.hasMatch);
  if (!firstMatch) return;

  Syntra.ui.expandSection(firstMatch.id);
  document.getElementById(firstMatch.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function applyGlobalSearch() {
  Syntra.tasks.renderTasksFromCache();
  Syntra.tasks.renderNotesFromCache();
  Syntra.tasks.renderTeamFromCache();
  scrollToFirstSearchMatch();
}

function updateTaskFilterAssigneeOptions() {
  const select = document.getElementById("task-filter-assignee");
  if (!select) return;

  const current = select.value;
  select.innerHTML =
    '<option value="">All assignees</option>' +
    '<option value="unassigned">Unassigned</option>' +
    Syntra.state.teamCache
      .map((member) => `<option value="${member.id}">${Syntra.core.escapeHtml(member.name)}</option>`)
      .join("");
  select.value = current;
  updateMyWorkFilterButton();
}

function hasMyWorkProfileLink() {
  return Boolean(Syntra.state.profileCache?.team_member_id);
}

function isMyWorkFilterActive() {
  return (
    hasMyWorkProfileLink() &&
    Syntra.state.taskFilters.assignee === String(Syntra.state.profileCache.team_member_id)
  );
}

function updateMyWorkFilterButton() {
  const btn = document.getElementById("task-filter-my-work");
  if (!btn) return;

  const linked = hasMyWorkProfileLink();
  const active = isMyWorkFilterActive();
  const memberName = Syntra.state.profileCache?.team_member_name || "you";

  btn.disabled = !linked;
  btn.classList.toggle("is-active", active);
  btn.setAttribute("aria-pressed", String(active));

  if (!linked) {
    btn.title = "Link a team member in Profile to use My Work";
    btn.setAttribute("aria-label", "My Work filter unavailable — link a team member in Profile");
    return;
  }

  btn.title = active
    ? `Showing tasks assigned to ${memberName}. Click to clear.`
    : `Show tasks assigned to ${memberName}`;
  btn.setAttribute(
    "aria-label",
    active ? `My Work filter active for ${memberName}` : `Filter tasks assigned to ${memberName}`
  );
}

function applyMyWorkFilter() {
  if (!hasMyWorkProfileLink()) {
    Syntra.core.toast("Link a team member in Profile first", true);
    return;
  }

  const memberId = String(Syntra.state.profileCache.team_member_id);
  Syntra.state.taskFilters.assignee = isMyWorkFilterActive() ? "" : memberId;

  const assigneeSelect = document.getElementById("task-filter-assignee");
  if (assigneeSelect) assigneeSelect.value = Syntra.state.taskFilters.assignee;

  updateMyWorkFilterButton();
  Syntra.ui.expandSection("my-tasks");
  Syntra.tasks.renderTasksFromCache();
}

function syncMyWorkFilterAfterProfileChange(previousMemberId) {
  if (!previousMemberId || String(previousMemberId) !== Syntra.state.taskFilters.assignee) {
    updateMyWorkFilterButton();
    return;
  }

  Syntra.state.taskFilters.assignee = Syntra.state.profileCache?.team_member_id
    ? String(Syntra.state.profileCache.team_member_id)
    : "";

  const assigneeSelect = document.getElementById("task-filter-assignee");
  if (assigneeSelect) assigneeSelect.value = Syntra.state.taskFilters.assignee;

  updateMyWorkFilterButton();
  Syntra.tasks.renderTasksFromCache();
}

function initSearch() {
  const input = document.querySelector(".search-box");
  if (!input || input.dataset.bound === "true") return;
  input.dataset.bound = "true";

  let debounceTimer = null;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      Syntra.state.searchQuery = input.value;
      applyGlobalSearch();
    }, 200);
  });
}

function initTaskFilters() {
  const container = document.getElementById("task-filters");
  if (!container || container.dataset.bound === "true") return;
  container.dataset.bound = "true";

  const statusSelect = document.getElementById("task-filter-status");
  const prioritySelect = document.getElementById("task-filter-priority");
  const assigneeSelect = document.getElementById("task-filter-assignee");

  statusSelect?.addEventListener("change", () => {
    Syntra.state.taskFilters.status = statusSelect.value;
    Syntra.tasks.renderTasksFromCache();
  });

  prioritySelect?.addEventListener("change", () => {
    Syntra.state.taskFilters.priority = prioritySelect.value;
    Syntra.tasks.renderTasksFromCache();
  });

  assigneeSelect?.addEventListener("change", () => {
    Syntra.state.taskFilters.assignee = assigneeSelect.value;
    updateMyWorkFilterButton();
    Syntra.tasks.renderTasksFromCache();
  });

  document.getElementById("task-filter-my-work")?.addEventListener("click", applyMyWorkFilter);
}

  Syntra.search = { taskMatchesSearch, noteMatchesSearch, memberMatchesSearch, getFilteredTasks, getFilteredNotes, getFilteredTeam, renderDueDateCell, scrollToFirstSearchMatch, applyGlobalSearch, updateTaskFilterAssigneeOptions, hasMyWorkProfileLink, isMyWorkFilterActive, updateMyWorkFilterButton, applyMyWorkFilter, syncMyWorkFilterAfterProfileChange, initSearch, initTaskFilters };

})(window);
