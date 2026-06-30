const API = {
  tasks: "/api/tasks",
  taskGroups: "/api/task-groups",
  archivedTaskGroups: "/api/task-groups/archived",
  notes: "/api/notes",
  team: "/api/team",
  reminders: "/api/reminders",
  mcp: "/api/mcp",
};

const TASK_TOOLS = new Set(["create_task", "list_tasks", "assign_task"]);
const NOTE_TOOLS = new Set(["create_note", "list_notes"]);

let taskCache = [];
let taskGroupCache = [];
let archivedGroupCache = [];
const expandedTaskGroups = new Set();
const expandedArchivedGroups = new Set();
const expandedTaskComments = new Set();
const taskCommentsCache = {};
let noteCache = [];
let teamCache = [];
let reminderCache = [];

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

function toast(message, isError = false) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.className = "toast show" + (isError ? " error" : "");
  setTimeout(() => el.classList.remove("show"), 3000);
}

const CONFIRM_ICONS = {
  default: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.75 5a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 1.5 0V7zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg>`,
  danger: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"/></svg>`,
};

let confirmResolver = null;

function closeConfirmModal(result) {
  const modal = document.getElementById("confirm-modal");
  if (!modal) return;

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");

  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

function confirmDialog({
  title = "Confirm action",
  message = "Are you sure you want to continue?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const dialog = document.getElementById("confirm-modal-dialog");
    const icon = document.getElementById("confirm-modal-icon");
    const titleEl = document.getElementById("confirm-modal-title");
    const messageEl = document.getElementById("confirm-modal-message");
    const cancelBtn = document.getElementById("confirm-modal-cancel");
    const confirmBtn = document.getElementById("confirm-modal-confirm");

    if (!modal || !dialog || !titleEl || !messageEl || !cancelBtn || !confirmBtn) {
      resolve(window.confirm(message));
      return;
    }

    if (confirmResolver) {
      closeConfirmModal(false);
    }

    confirmResolver = resolve;

    dialog.className = `confirm-modal-dialog confirm-modal-dialog--${variant}`;
    if (icon) icon.innerHTML = CONFIRM_ICONS[variant] || CONFIRM_ICONS.default;
    titleEl.textContent = title;
    messageEl.textContent = message;
    cancelBtn.textContent = cancelText;
    confirmBtn.textContent = confirmText;

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    cancelBtn.focus();
  });
}

function initConfirmModal() {
  const modal = document.getElementById("confirm-modal");
  const cancelBtn = document.getElementById("confirm-modal-cancel");
  const confirmBtn = document.getElementById("confirm-modal-confirm");
  if (!modal || modal.dataset.bound === "true") return;
  modal.dataset.bound = "true";

  cancelBtn?.addEventListener("click", () => closeConfirmModal(false));
  confirmBtn?.addEventListener("click", () => closeConfirmModal(true));

  modal.querySelectorAll("[data-confirm-dismiss]").forEach((el) => {
    el.addEventListener("click", () => closeConfirmModal(false));
  });

  document.addEventListener("keydown", (event) => {
    if (modal.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeConfirmModal(false);
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function updateAssigneeOptions(members) {
  const options =
    '<option value="">Assign to team member</option>' +
    members.map((member) =>
      `<option value="${member.id}">${escapeHtml(member.name)}</option>`
    ).join("");

  ["reminder-assignee", "reminder-edit-assignee", "task-assignee", "task-edit-assignee"].forEach((id) => {
    const select = document.getElementById(id);
    if (select) select.innerHTML = options;
  });
}

function updateGroupOptions(groups) {
  taskGroupCache = groups;
  const groupOptions = groups.map((group) =>
    `<option value="${group.id}">${escapeHtml(group.name)}</option>`
  ).join("");

  const editSelect = document.getElementById("task-edit-group");
  if (editSelect) {
    editSelect.innerHTML = '<option value="">Select group</option>' + groupOptions;
  }

  const createSelect = document.getElementById("task-group");
  if (createSelect) {
    createSelect.innerHTML =
      '<option value="">Select group</option>' +
      groupOptions +
      '<option value="__new__">New</option>';
  }

  syncTaskGroupNewField();
}

function syncTaskGroupNewField() {
  const select = document.getElementById("task-group");
  const newInput = document.getElementById("task-group-new");
  if (!select || !newInput) return;

  const isNew = select.value === "__new__";
  newInput.hidden = !isNew;
  newInput.required = isNew;
  if (!isNew) {
    newInput.value = "";
  }
}

async function loadTaskGroups() {
  const groups = await request(API.taskGroups);
  updateGroupOptions(groups);
  return groups;
}

function resolveCreateGroupPayload() {
  const groupValue = document.getElementById("task-group").value;
  if (!groupValue) {
    throw new Error("Select a group");
  }

  if (groupValue === "__new__") {
    const newGroup = document.getElementById("task-group-new").value.trim();
    if (!newGroup) {
      throw new Error("Enter a new group name");
    }
    return { group_name: newGroup };
  }

  return { group_id: parseInt(groupValue, 10) };
}

function groupTasksByGroup(tasks) {
  const grouped = new Map();
  tasks.forEach((task) => {
    const key = task.group_id != null ? String(task.group_id) : `name:${task.group_name || "Ungrouped"}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        id: task.group_id,
        name: task.group_name || "Ungrouped",
        tasks: [],
      });
    }
    grouped.get(key).tasks.push(task);
  });
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function renderTaskGroupBlock(group, options = {}) {
  const { showArchive = false, expandedSet = expandedTaskGroups, groupKeyPrefix = "" } = options;
  const groupName = group.name;
  const groupTasks = group.tasks;
  const isCollapsed = !expandedSet.has(groupKeyPrefix + groupName);
  const groupKey = encodeURIComponent(groupName);
  const archiveButton =
    showArchive && group.id
      ? `<button type="button" class="task-group-archive-btn" data-group-id="${group.id}" data-group-name="${escapeHtml(groupName)}" aria-label="Archive group" title="Archive group">Archive</button>`
      : "";

  return `
    <div class="task-group-block${isCollapsed ? " is-collapsed" : ""}" data-group-key="${groupKey}" data-group-prefix="${escapeHtml(groupKeyPrefix)}">
      <div class="task-group-header-row">
        <button type="button" class="task-group-header" aria-expanded="${!isCollapsed}">
          <span class="task-group-chevron" aria-hidden="true"></span>
          <span class="task-group-name">${escapeHtml(groupName)}</span>
          <span class="task-group-count">${groupTasks.length}</span>
        </button>
        ${archiveButton}
      </div>
      <div class="task-group-body"${isCollapsed ? " hidden" : ""}>
        <table>
          <thead>
            <tr>
              <th>Title</th><th>Status</th><th>Priority</th><th>Assigned To</th><th>Created</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${groupTasks.map((task) => renderTaskRow(task)).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderArchivedTaskRow(task) {
  return `
    <tr>
      <td>${escapeHtml(task.title)}</td>
      <td><span class="status status-${task.status}">${task.status.replace("_", " ")}</span></td>
      <td>${escapeHtml(task.priority || "—")}</td>
      <td>${escapeHtml(task.assignee_name || "—")}</td>
      <td>${escapeHtml(formatDateTime(task.created_at))}</td>
      <td>${task.comment_count ? `${task.comment_count} comment${task.comment_count === 1 ? "" : "s"}` : "—"}</td>
    </tr>`;
}

function renderArchivedGroupBlock(group) {
  const groupName = group.name;
  const groupTasks = group.tasks || [];
  const taskCount = group.task_count ?? groupTasks.length;
  const storageKey = `archived:${groupName}`;
  const isCollapsed = !expandedArchivedGroups.has(storageKey);
  const groupKey = encodeURIComponent(groupName);

  return `
    <div class="task-group-block archived-group-block${isCollapsed ? " is-collapsed" : ""}" data-group-key="${groupKey}" data-group-prefix="archived:">
      <div class="task-group-header-row">
        <button type="button" class="task-group-header" aria-expanded="${!isCollapsed}">
          <span class="task-group-chevron" aria-hidden="true"></span>
          <span class="task-group-name">${escapeHtml(groupName)}</span>
          <span class="task-group-count">${groupTasks.length}</span>
        </button>
        <div class="archived-group-actions">
          <span class="archived-badge">Archived</span>
          <button type="button" class="task-group-restore-btn" data-group-id="${group.id}" data-group-name="${escapeHtml(groupName)}" data-task-count="${taskCount}" aria-label="Restore group" title="Restore group">Restore</button>
          <button type="button" class="task-group-delete-btn" data-group-id="${group.id}" data-group-name="${escapeHtml(groupName)}" data-task-count="${taskCount}" aria-label="Delete group" title="Delete group">Delete</button>
        </div>
      </div>
      <div class="task-group-body"${isCollapsed ? " hidden" : ""}>
        ${
          groupTasks.length
            ? `<table>
                <thead>
                  <tr>
                    <th>Title</th><th>Status</th><th>Priority</th><th>Assigned To</th><th>Created</th><th>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  ${groupTasks.map((task) => renderArchivedTaskRow(task)).join("")}
                </tbody>
              </table>`
            : '<p class="empty">No tasks in this archived group.</p>'
        }
      </div>
    </div>`;
}

function toggleTaskGroup(block, expandedSet = expandedTaskGroups) {
  const groupName = decodeURIComponent(block.dataset.groupKey);
  const prefix = block.dataset.groupPrefix || "";
  const storageKey = prefix ? prefix + groupName : groupName;
  const header = block.querySelector(".task-group-header");
  const body = block.querySelector(".task-group-body");
  const willCollapse = !block.classList.contains("is-collapsed");

  block.classList.toggle("is-collapsed", willCollapse);
  body.hidden = willCollapse;
  header.setAttribute("aria-expanded", String(!willCollapse));

  if (willCollapse) {
    expandedSet.delete(storageKey);
  } else {
    expandedSet.add(storageKey);
  }
}

async function archiveTaskGroup(groupId, groupName) {
  const taskCount = (taskCache.filter((task) => task.group_id === groupId)).length;
  const confirmed = await confirmDialog({
    title: `Archive "${groupName}"?`,
    message:
      taskCount > 0
        ? `This group and its ${taskCount} task${taskCount === 1 ? "" : "s"} will move to Archive and leave My Tasks.`
        : "This group will move to Archive and leave My Tasks.",
    confirmText: "Archive",
    variant: "warning",
  });
  if (!confirmed) return;

  await request(`${API.taskGroups}/${groupId}/archive`, { method: "POST" });
  toast(`"${groupName}" archived`);
  expandedTaskGroups.delete(groupName);
  await loadDashboard();
  await loadArchivedGroups();
}

async function restoreArchivedGroup(groupId, groupName, taskCount) {
  const confirmed = await confirmDialog({
    title: `Restore "${groupName}"?`,
    message:
      taskCount > 0
        ? `This group and its ${taskCount} task${taskCount === 1 ? "" : "s"} will return to My Tasks.`
        : "This group will return to My Tasks.",
    confirmText: "Restore",
    variant: "default",
  });
  if (!confirmed) return;

  await request(`${API.taskGroups}/${groupId}/restore`, { method: "POST" });
  toast(`"${groupName}" restored`);
  expandedArchivedGroups.delete(`archived:${groupName}`);
  await loadDashboard();
  await loadArchivedGroups();
}

async function deleteArchivedGroup(groupId, groupName, taskCount) {
  const confirmed = await confirmDialog({
    title: `Delete "${groupName}" permanently?`,
    message:
      taskCount > 0
        ? `This will permanently delete the group and all ${taskCount} task${taskCount === 1 ? "" : "s"}. This action cannot be undone.`
        : "This will permanently delete the group. This action cannot be undone.",
    confirmText: "Delete",
    variant: "danger",
  });
  if (!confirmed) return;

  await request(`${API.taskGroups}/${groupId}`, { method: "DELETE" });
  toast(`"${groupName}" deleted`);
  expandedArchivedGroups.delete(`archived:${groupName}`);
  await loadArchivedGroups();
}

function bindTaskGroupEvents() {
  const container = document.getElementById("tasks-list");
  if (!container || container.dataset.groupsBound === "true") return;
  container.dataset.groupsBound = "true";

  container.addEventListener("click", (event) => {
    const archiveBtn = event.target.closest(".task-group-archive-btn");
    if (archiveBtn) {
      event.stopPropagation();
      const groupId = parseInt(archiveBtn.dataset.groupId, 10);
      const groupName = archiveBtn.dataset.groupName;
      archiveTaskGroup(groupId, groupName).catch((err) => toast(err.message, true));
      return;
    }

    const header = event.target.closest(".task-group-header");
    if (!header) return;
    const block = header.closest(".task-group-block");
    if (block) toggleTaskGroup(block);
  });
}

function bindArchiveGroupEvents() {
  const container = document.getElementById("archive-list");
  if (!container || container.dataset.groupsBound === "true") return;
  container.dataset.groupsBound = "true";

  container.addEventListener("click", (event) => {
    const restoreBtn = event.target.closest(".task-group-restore-btn");
    if (restoreBtn) {
      event.stopPropagation();
      restoreArchivedGroup(
        parseInt(restoreBtn.dataset.groupId, 10),
        restoreBtn.dataset.groupName,
        parseInt(restoreBtn.dataset.taskCount, 10) || 0
      ).catch((err) => toast(err.message, true));
      return;
    }

    const deleteBtn = event.target.closest(".task-group-delete-btn");
    if (deleteBtn) {
      event.stopPropagation();
      deleteArchivedGroup(
        parseInt(deleteBtn.dataset.groupId, 10),
        deleteBtn.dataset.groupName,
        parseInt(deleteBtn.dataset.taskCount, 10) || 0
      ).catch((err) => toast(err.message, true));
      return;
    }

    const header = event.target.closest(".task-group-header");
    if (!header) return;
    const block = header.closest(".task-group-block");
    if (block) toggleTaskGroup(block, expandedArchivedGroups);
  });
}

function renderTaskRow(task) {
  const commentsOpen = expandedTaskComments.has(task.id);
  const commentCount = task.comment_count || 0;

  return `
    <tr class="editable-row" data-id="${task.id}" title="Double-click to edit">
      <td>${escapeHtml(task.title)}</td>
      <td><span class="status status-${task.status}">${task.status.replace("_", " ")}</span></td>
      <td>${escapeHtml(task.priority || "—")}</td>
      <td>${escapeHtml(task.assignee_name || "—")}</td>
      <td>${escapeHtml(formatDateTime(task.created_at))}</td>
      <td class="actions-cell">
        <button type="button" class="task-comments-btn" data-id="${task.id}" aria-label="View comments" title="Comments">
          <span class="task-comments-icon" aria-hidden="true">💬</span>
          <span class="task-comments-count" id="task-comment-count-${task.id}">${commentCount}</span>
        </button>
        ${renderDeleteButton(task.id, "task")}
      </td>
    </tr>
    <tr class="task-comments-row" id="task-comments-${task.id}"${commentsOpen ? "" : " hidden"}>
      <td colspan="6">
        <div class="task-comments-panel" data-task-id="${task.id}">
          <div class="task-comments-list" id="task-comments-list-${task.id}">
            ${commentsOpen ? '<p class="empty">Loading comments...</p>' : ""}
          </div>
          <form class="task-comment-form" data-task-id="${task.id}">
            <input type="text" class="task-comment-input" placeholder="Add a progress comment..." required>
            <button type="submit" class="inline-submit">Post</button>
          </form>
        </div>
      </td>
    </tr>`;
}

async function loadTaskComments(taskId) {
  const listEl = document.getElementById(`task-comments-list-${taskId}`);
  if (!listEl) return;

  try {
    const comments = await request(`${API.tasks}/${taskId}/comments`);
    taskCommentsCache[taskId] = comments;
    renderTaskCommentsList(taskId, comments);
    updateTaskCommentCount(taskId, comments.length);
  } catch (err) {
    listEl.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
  }
}

function renderTaskCommentsList(taskId, comments) {
  const listEl = document.getElementById(`task-comments-list-${taskId}`);
  if (!listEl) return;

  if (!comments.length) {
    listEl.innerHTML = '<p class="empty">No comments yet. Add one below.</p>';
    return;
  }

  listEl.innerHTML = comments.map((entry) => `
    <div class="task-comment-item">
      <div class="task-comment-meta">
        <span class="task-comment-author">${escapeHtml(entry.author_name || "User")}</span>
        <span class="task-comment-time">${escapeHtml(formatDateTime(entry.created_at))}</span>
        <button type="button" class="task-comment-delete" data-task-id="${taskId}" data-id="${entry.id}" aria-label="Delete comment" title="Delete">×</button>
      </div>
      <p class="task-comment-text">${escapeHtml(entry.comment)}</p>
    </div>
  `).join("");
}

function updateTaskCommentCount(taskId, count) {
  const badge = document.getElementById(`task-comment-count-${taskId}`);
  if (badge) badge.textContent = count;
  const task = taskCache.find((item) => item.id === taskId);
  if (task) task.comment_count = count;
}

async function toggleTaskComments(taskId) {
  const row = document.getElementById(`task-comments-${taskId}`);
  if (!row) return;

  const isOpen = !row.hidden;
  if (isOpen) {
    row.hidden = true;
    expandedTaskComments.delete(taskId);
    return;
  }

  row.hidden = false;
  expandedTaskComments.add(taskId);
  await loadTaskComments(taskId);
}

async function addTaskComment(taskId, comment) {
  const entry = await request(`${API.tasks}/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
  taskCommentsCache[taskId] = [...(taskCommentsCache[taskId] || []), entry];
  renderTaskCommentsList(taskId, taskCommentsCache[taskId]);
  updateTaskCommentCount(taskId, taskCommentsCache[taskId].length);
  toast("Comment added");
  return entry;
}

async function deleteTaskComment(taskId, commentId) {
  const confirmed = await confirmDialog({
    title: "Delete comment?",
    message: "This comment will be permanently removed.",
    confirmText: "Delete",
    variant: "danger",
  });
  if (!confirmed) return;

  await request(`${API.tasks}/${taskId}/comments/${commentId}`, { method: "DELETE" });
  taskCommentsCache[taskId] = (taskCommentsCache[taskId] || []).filter((item) => item.id !== commentId);
  renderTaskCommentsList(taskId, taskCommentsCache[taskId]);
  updateTaskCommentCount(taskId, taskCommentsCache[taskId].length);
  toast("Comment deleted");
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10) === today;
}

function updateDashboardStats(tasks, members) {
  document.getElementById("stat-total-tasks").textContent = tasks.length;
  document.getElementById("stat-completed").textContent =
    tasks.filter((task) => task.status === "done").length;
  document.getElementById("stat-due-today").textContent =
    tasks.filter((task) => isToday(task.due_date)).length;
  document.getElementById("stat-team-members").textContent = members.length;
}

function setSectionCollapsed(section, collapsed) {
  const content = section.querySelector(".section-content");
  const btn = section.querySelector(".section-collapse-btn");
  if (!content) return;

  section.classList.toggle("is-collapsed", collapsed);
  content.hidden = collapsed;
  if (btn) {
    btn.setAttribute("aria-expanded", String(!collapsed));
    const sectionTitle = section.querySelector(".section-title")?.textContent?.trim() || "section";
    btn.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${sectionTitle} section`);
  }
}

function expandSection(sectionOrId) {
  const section =
    typeof sectionOrId === "string" ? document.getElementById(sectionOrId) : sectionOrId;
  if (!section || !section.classList.contains("section-collapsible")) return;
  if (section.classList.contains("is-collapsed")) {
    setSectionCollapsed(section, false);
  }
}

function initSectionCollapse() {
  document.querySelectorAll(".section-collapsible").forEach((section) => {
    setSectionCollapsed(section, true);

    const btn = section.querySelector(".section-collapse-btn");
    if (!btn || btn.dataset.bound === "true") return;
    btn.dataset.bound = "true";

    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const willCollapse = !section.classList.contains("is-collapsed");
      setSectionCollapsed(section, willCollapse);
    });
  });
}

function toggleCreatePanel(panelId, toggleBtn) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const isOpen = !panel.hidden;
  document.querySelectorAll(".create-panel").forEach((item) => {
    item.hidden = true;
  });
  document.querySelectorAll(".section-add-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (!isOpen) {
    expandSection(panel.closest(".section-collapsible"));
    panel.hidden = false;
    if (toggleBtn) toggleBtn.classList.add("active");
    if (panelId === "task-create-panel") {
      const form = document.getElementById("task-form");
      if (form) form.reset();
      syncTaskGroupNewField();
    }
    const firstInput = panel.querySelector("input:not([type='hidden']):not([hidden])");
    if (firstInput) firstInput.focus();
  }
}

function closeCreatePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (panel) panel.hidden = true;
  if (panelId && panelId.includes("edit")) {
    document.querySelectorAll(".editable-row.row-active").forEach((row) => {
      row.classList.remove("row-active");
    });
  }
  document.querySelectorAll(".section-add-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
}

function renderDeleteButton(id, label) {
  return `
    <button type="button" class="row-delete-btn" data-id="${id}" aria-label="Delete ${label}" title="Delete">
      ${DELETE_ICON}
    </button>`;
}

function highlightRow(id) {
  document.querySelectorAll(".editable-row.row-active").forEach((row) => {
    row.classList.remove("row-active");
  });
  const row = document.querySelector(`.editable-row[data-id="${id}"]`);
  if (row) row.classList.add("row-active");
}

function openEditPanel(panelId, focusId) {
  document.querySelectorAll(".create-panel").forEach((panel) => {
    if (panel.id !== panelId) panel.hidden = true;
  });
  const panel = document.getElementById(panelId);
  expandSection(panel.closest(".section-collapsible"));
  panel.hidden = false;
  const focusEl = document.getElementById(focusId);
  if (focusEl) focusEl.focus();
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function toLocalDateTimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

async function deleteResource(url, label, editPanelId, refresh) {
  const confirmed = await confirmDialog({
    title: `Delete ${label}?`,
    message: `This ${label} will be permanently removed. This action cannot be undone.`,
    confirmText: "Delete",
    variant: "danger",
  });
  if (!confirmed) return;

  const res = await fetch(url, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to delete ${label}`);
  }

  toast(`${label.charAt(0).toUpperCase()}${label.slice(1)} deleted`);
  closeCreatePanel(editPanelId);
  await refresh();
}

function bindEditableList(containerId, getCache, onEdit, onDelete) {
  const container = document.getElementById(containerId);
  if (!container || container.dataset.bound === "true") return;
  container.dataset.bound = "true";

  container.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest(".row-delete-btn");
    if (!deleteBtn) return;
    event.stopPropagation();
    onDelete(parseInt(deleteBtn.dataset.id, 10)).catch((err) => toast(err.message, true));
  });

  container.addEventListener("dblclick", (event) => {
    if (event.target.closest(".row-delete-btn")) return;
    const row = event.target.closest(".editable-row");
    if (!row) return;
    const item = getCache().find((entry) => String(entry.id) === row.dataset.id);
    if (item) onEdit(item);
  });
}

const DELETE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"/>
  </svg>`;

function formatDueDateInput(value) {
  if (!value) return "";
  return value.slice(0, 10);
}

function openTaskEdit(task) {
  closeCreatePanel("task-create-panel");
  document.getElementById("task-edit-id").value = task.id;
  document.getElementById("task-edit-title").value = task.title || "";
  document.getElementById("task-edit-group").value = task.group_id || "";
  document.getElementById("task-edit-assignee").value = task.assigned_to || "";
  document.getElementById("task-edit-status").value = task.status || "pending";
  document.getElementById("task-edit-priority").value = task.priority || "medium";
  document.getElementById("task-edit-due").value = formatDueDateInput(task.due_date);
  highlightRow(task.id);
  openEditPanel("task-edit-panel", "task-edit-title");
}

function openNoteEdit(note) {
  closeCreatePanel("note-create-panel");
  document.getElementById("note-edit-id").value = note.id;
  document.getElementById("note-edit-title").value = note.title || "";
  document.getElementById("note-edit-content").value = note.content || "";
  highlightRow(note.id);
  openEditPanel("note-edit-panel", "note-edit-title");
}

function openTeamEdit(member) {
  closeCreatePanel("team-create-panel");
  document.getElementById("team-edit-id").value = member.id;
  document.getElementById("team-edit-name").value = member.name || "";
  document.getElementById("team-edit-role").value = member.role || "";
  document.getElementById("team-edit-email").value = member.email || "";
  document.getElementById("team-edit-status").value = member.status || "offline";
  highlightRow(member.id);
  openEditPanel("team-edit-panel", "team-edit-name");
}

function openReminderEdit(reminder) {
  document.getElementById("reminder-edit-id").value = reminder.id;
  document.getElementById("reminder-edit-title").value = reminder.title || "";
  document.getElementById("reminder-edit-datetime").value = toLocalDateTimeValue(reminder.remind_at);
  document.getElementById("reminder-edit-assignee").value = reminder.assigned_to || "";
  document.getElementById("reminder-edit-status").value = reminder.status || "pending";
  highlightRow(reminder.id);
  openEditPanel("reminder-edit-panel", "reminder-edit-title");
}

async function updateTask(taskId, payload) {
  const task = await request(`${API.tasks}/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  toast("Task updated");
  closeCreatePanel("task-edit-panel");
  const tasks = await loadTasks();
  const members = await request(API.team);
  updateDashboardStats(tasks, members);
  return task;
}

async function deleteTask(taskId) {
  expandedTaskComments.delete(taskId);
  delete taskCommentsCache[taskId];
  await deleteResource(`${API.tasks}/${taskId}`, "task", "task-edit-panel", async () => {
    const tasks = await loadTasks();
    const members = await request(API.team);
    updateDashboardStats(tasks, members);
  });
}

async function updateNote(noteId, payload) {
  const note = await request(`${API.notes}/${noteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  toast("Note updated");
  closeCreatePanel("note-edit-panel");
  await loadNotes();
  return note;
}

async function deleteNote(noteId) {
  await deleteResource(`${API.notes}/${noteId}`, "note", "note-edit-panel", loadNotes);
}

async function updateTeamMember(memberId, payload) {
  const member = await request(`${API.team}/${memberId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  toast("Team member updated");
  closeCreatePanel("team-edit-panel");
  await loadDashboard();
  return member;
}

async function deleteTeamMember(memberId) {
  await deleteResource(`${API.team}/${memberId}`, "team member", "team-edit-panel", loadDashboard);
}

async function updateReminder(reminderId, payload) {
  const reminder = await request(`${API.reminders}/${reminderId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  toast("Reminder updated");
  closeCreatePanel("reminder-edit-panel");
  await loadReminders();
  return reminder;
}

async function deleteReminder(reminderId) {
  await deleteResource(`${API.reminders}/${reminderId}`, "reminder", "reminder-edit-panel", loadReminders);
}

function bindTaskListEvents() {
  const container = document.getElementById("tasks-list");
  if (!container || container.dataset.bound === "true") return;
  container.dataset.bound = "true";

  container.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest(".row-delete-btn");
    if (deleteBtn) {
      event.stopPropagation();
      deleteTask(parseInt(deleteBtn.dataset.id, 10)).catch((err) => toast(err.message, true));
      return;
    }

    const commentsBtn = event.target.closest(".task-comments-btn");
    if (commentsBtn) {
      event.stopPropagation();
      toggleTaskComments(parseInt(commentsBtn.dataset.id, 10)).catch((err) => toast(err.message, true));
      return;
    }

    const deleteCommentBtn = event.target.closest(".task-comment-delete");
    if (deleteCommentBtn) {
      event.stopPropagation();
      deleteTaskComment(
        parseInt(deleteCommentBtn.dataset.taskId, 10),
        parseInt(deleteCommentBtn.dataset.id, 10)
      ).catch((err) => toast(err.message, true));
    }
  });

  container.addEventListener("dblclick", (event) => {
    if (event.target.closest(".row-delete-btn, .task-comments-btn, .task-comment-delete, .task-comment-form")) {
      return;
    }
    const row = event.target.closest(".editable-row");
    if (!row) return;
    const task = taskCache.find((entry) => String(entry.id) === row.dataset.id);
    if (task) openTaskEdit(task);
  });

  container.addEventListener("submit", (event) => {
    const form = event.target.closest(".task-comment-form");
    if (!form) return;
    event.preventDefault();
    const taskId = parseInt(form.dataset.taskId, 10);
    const input = form.querySelector(".task-comment-input");
    const text = input.value.trim();
    if (!text) return;
    addTaskComment(taskId, text)
      .then(() => {
        input.value = "";
      })
      .catch((err) => toast(err.message, true));
  });
}

function bindNoteListEvents() {
  bindEditableList("notes-list", () => noteCache, openNoteEdit, deleteNote);
}

function bindTeamListEvents() {
  bindEditableList("team-list", () => teamCache, openTeamEdit, deleteTeamMember);
}

function bindReminderListEvents() {
  bindEditableList("reminders-list", () => reminderCache, openReminderEdit, deleteReminder);
}

function initCreatePanels() {
  const toggles = [
    { btn: "task-add-toggle", panel: "task-create-panel" },
    { btn: "note-add-toggle", panel: "note-create-panel" },
    { btn: "team-add-toggle", panel: "team-create-panel" },
  ];

  toggles.forEach(({ btn, panel }) => {
    const toggleBtn = document.getElementById(btn);
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => toggleCreatePanel(panel, toggleBtn));
    }
  });

  document.querySelectorAll(".inline-cancel").forEach((btn) => {
    btn.addEventListener("click", () => closeCreatePanel(btn.dataset.panel));
  });

  const taskForm = document.getElementById("task-form");
  if (taskForm) {
    const taskGroupSelect = document.getElementById("task-group");
    if (taskGroupSelect) {
      taskGroupSelect.addEventListener("change", syncTaskGroupNewField);
    }

    taskForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const assignee = document.getElementById("task-assignee").value;
        await addTask({
          title: document.getElementById("task-title").value.trim(),
          ...resolveCreateGroupPayload(),
          assigned_to: assignee ? parseInt(assignee, 10) : null,
        });
        taskForm.reset();
        syncTaskGroupNewField();
        closeCreatePanel("task-create-panel");
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  const taskEditForm = document.getElementById("task-edit-form");
  if (taskEditForm) {
    taskEditForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const taskId = parseInt(document.getElementById("task-edit-id").value, 10);
      const dueDate = document.getElementById("task-edit-due").value;
      const assignee = document.getElementById("task-edit-assignee").value;
      const groupId = document.getElementById("task-edit-group").value;
      try {
        await updateTask(taskId, {
          title: document.getElementById("task-edit-title").value.trim(),
          group_id: groupId ? parseInt(groupId, 10) : null,
          assigned_to: assignee ? parseInt(assignee, 10) : null,
          status: document.getElementById("task-edit-status").value,
          priority: document.getElementById("task-edit-priority").value,
          due_date: dueDate || null,
        });
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  bindTaskListEvents();
  bindTaskGroupEvents();
  bindArchiveGroupEvents();
  bindNoteListEvents();
  bindTeamListEvents();
  bindReminderListEvents();

  const noteEditForm = document.getElementById("note-edit-form");
  if (noteEditForm) {
    noteEditForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const noteId = parseInt(document.getElementById("note-edit-id").value, 10);
      try {
        await updateNote(noteId, {
          title: document.getElementById("note-edit-title").value.trim(),
          content: document.getElementById("note-edit-content").value.trim() || null,
        });
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  const teamEditForm = document.getElementById("team-edit-form");
  if (teamEditForm) {
    teamEditForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const memberId = parseInt(document.getElementById("team-edit-id").value, 10);
      try {
        await updateTeamMember(memberId, {
          name: document.getElementById("team-edit-name").value.trim(),
          role: document.getElementById("team-edit-role").value.trim() || null,
          email: document.getElementById("team-edit-email").value.trim() || null,
          status: document.getElementById("team-edit-status").value,
        });
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  const reminderEditForm = document.getElementById("reminder-edit-form");
  if (reminderEditForm) {
    reminderEditForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const reminderId = parseInt(document.getElementById("reminder-edit-id").value, 10);
      const assignee = document.getElementById("reminder-edit-assignee").value;
      try {
        await updateReminder(reminderId, {
          title: document.getElementById("reminder-edit-title").value.trim(),
          remind_at: document.getElementById("reminder-edit-datetime").value,
          assigned_to: assignee ? parseInt(assignee, 10) : null,
          status: document.getElementById("reminder-edit-status").value,
        });
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  const noteForm = document.getElementById("note-form");
  if (noteForm) {
    noteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await addNote({
          title: document.getElementById("note-title").value.trim(),
          content: document.getElementById("note-content").value.trim() || null,
        });
        noteForm.reset();
        closeCreatePanel("note-create-panel");
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  const teamForm = document.getElementById("team-form");
  if (teamForm) {
    teamForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await addTeamMember({ name: document.getElementById("team-name").value.trim() });
        teamForm.reset();
        closeCreatePanel("team-create-panel");
      } catch (err) {
        toast(err.message, true);
      }
    });
  }
}

async function loadTasks() {
  const tasks = await request(API.tasks);
  taskCache = tasks;
  const container = document.getElementById("tasks-list");

  if (!tasks.length) {
    container.innerHTML = '<p class="empty">No tasks yet. Click + to add one.</p>';
    return tasks;
  }

  container.innerHTML = groupTasksByGroup(tasks)
    .map((group) => renderTaskGroupBlock(group, { showArchive: Boolean(group.id) }))
    .join("");

  expandedTaskComments.forEach((taskId) => {
    if (document.getElementById(`task-comments-${taskId}`)) {
      loadTaskComments(taskId).catch((err) => toast(err.message, true));
    }
  });

  return tasks;
}

async function loadNotes() {
  const notes = await request(API.notes);
  noteCache = notes;
  const container = document.getElementById("notes-list");

  if (!notes.length) {
    container.innerHTML = '<p class="empty">No notes yet. Click + to add one.</p>';
    return notes;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr><th>Title</th><th>Content</th><th>Updated</th><th></th></tr>
      </thead>
      <tbody>
        ${notes.map((note) => `
          <tr class="editable-row" data-id="${note.id}" title="Double-click to edit">
            <td>${escapeHtml(note.title)}</td>
            <td>${escapeHtml(truncate(note.content, 80))}</td>
            <td>${escapeHtml(note.updated_at || note.created_at || "—")}</td>
            <td class="actions-cell">${renderDeleteButton(note.id, "note")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
  return notes;
}

async function loadTeam() {
  const members = await request(API.team);
  teamCache = members;
  const container = document.getElementById("team-list");

  if (!members.length) {
    container.innerHTML = '<p class="empty">No team members yet. Click + to add one.</p>';
    updateAssigneeOptions([]);
    return members;
  }

  updateAssigneeOptions(members);

  container.innerHTML = `
    <table>
      <thead>
        <tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${members.map((member) => `
          <tr class="editable-row" data-id="${member.id}" title="Double-click to edit">
            <td>${escapeHtml(member.name)}</td>
            <td>${escapeHtml(member.role || "—")}</td>
            <td>${escapeHtml(member.email || "—")}</td>
            <td>${escapeHtml(member.status || "—")}</td>
            <td class="actions-cell">${renderDeleteButton(member.id, "team member")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
  return members;
}

async function loadReminders() {
  const reminders = await request(API.reminders);
  reminderCache = reminders;
  const container = document.getElementById("reminders-list");

  if (!reminders.length) {
    container.innerHTML = '<p class="empty">No reminders yet. Add one above.</p>';
    return reminders;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr><th>Task</th><th>Remind At</th><th>Assigned To</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${reminders.map((reminder) => `
          <tr class="editable-row" data-id="${reminder.id}" title="Double-click to edit">
            <td>${escapeHtml(reminder.title)}</td>
            <td>${escapeHtml(formatDateTime(reminder.remind_at))}</td>
            <td>${escapeHtml(reminder.assignee_name || "—")}</td>
            <td><span class="status status-${reminder.status}">${reminder.status}</span></td>
            <td class="actions-cell">${renderDeleteButton(reminder.id, "reminder")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
  return reminders;
}

async function loadArchivedGroups() {
  const groups = await request(API.archivedTaskGroups);
  archivedGroupCache = groups;
  const container = document.getElementById("archive-list");
  if (!container) return groups;

  if (!groups.length) {
    container.innerHTML = '<p class="empty">No archived groups yet. Archive a group from My Tasks to see it here.</p>';
    return groups;
  }

  container.innerHTML = groups
    .map((group) => renderArchivedGroupBlock(group))
    .join("");

  return groups;
}

async function loadDashboard() {
  const [tasks, , members] = await Promise.all([
    loadTasks(),
    loadNotes(),
    loadTeam(),
    loadReminders(),
    loadTaskGroups(),
    loadArchivedGroups(),
  ]);
  updateDashboardStats(tasks, members);
  return { tasks, members };
}

async function addTask(payload) {
  const task = await request(API.tasks, {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      description: payload.description || null,
      priority: payload.priority || "medium",
      due_date: payload.due_date || null,
      group_id: payload.group_id || null,
      group_name: payload.group_name || null,
      assigned_to: payload.assigned_to || null,
    }),
  });
  toast("Task created");
  await loadDashboard();
  return task;
}

async function addNote(payload) {
  const note = await request(API.notes, {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      content: payload.content || null,
    }),
  });
  toast("Note created");
  await loadNotes();
  return note;
}

async function addTeamMember(payload) {
  const member = await request(API.team, {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      role: payload.role || null,
      email: payload.email || null,
    }),
  });
  toast("Team member added");
  await loadDashboard();
  return member;
}

async function addReminder(payload) {
  const reminder = await request(API.reminders, {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      remind_at: payload.remind_at,
      assigned_to: payload.assigned_to || null,
    }),
  });
  toast("Reminder created");
  await loadReminders();
  return reminder;
}

function formatScore(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Math.round(Number(value))}%`;
}

function setScoreBar(barEl, value) {
  if (!barEl) return;
  const pct = value != null && !Number.isNaN(Number(value)) ? Math.min(Number(value), 100) : 0;
  barEl.style.width = `${pct}%`;
}

function displayMcpResult(data, inputText) {
  const match = data.match || {};
  const scores = match.scores || {};

  document.getElementById("mcp-input-text").textContent = inputText || "—";

  const matchedToolEl = document.getElementById("mcp-matched-tool");
  if (match.no_match) {
    matchedToolEl.textContent = "No match";
    matchedToolEl.classList.add("mcp-no-match");
  } else if (match.tool_name) {
    matchedToolEl.textContent = match.tool_key
      ? `${match.tool_name} (${match.tool_key})`
      : match.tool_name;
    matchedToolEl.classList.remove("mcp-no-match");
  } else {
    matchedToolEl.textContent = "—";
    matchedToolEl.classList.remove("mcp-no-match");
  }

  const confidenceEl = document.getElementById("mcp-confidence");
  confidenceEl.textContent = formatScore(match.confidence);

  document.getElementById("mcp-keyword-score").textContent = formatScore(scores.keyword_score);
  document.getElementById("mcp-pattern-score").textContent = formatScore(scores.pattern_score);
  document.getElementById("mcp-token-score").textContent = formatScore(scores.token_score);

  setScoreBar(document.getElementById("mcp-keyword-bar"), scores.keyword_score);
  setScoreBar(document.getElementById("mcp-pattern-bar"), scores.pattern_score);
  setScoreBar(document.getElementById("mcp-token-bar"), scores.token_score);

  document.getElementById("mcp-reason").textContent = match.reason || "—";

  const resultEl = document.getElementById("mcp-result");
  let resultText = data.message || "No message returned";
  if (data.data !== undefined) {
    resultText += "\n\n" + JSON.stringify(data.data, null, 2);
  }
  resultEl.textContent = resultText;
  resultEl.className = "mcp-result-output " + (data.success ? "success" : "error");
}

async function refreshAfterMcp(data) {
  const toolKey = data.match && data.match.tool_key;
  if (!data.success || !toolKey) return;

  const refreshTasks = TASK_TOOLS.has(toolKey);
  const refreshNotes = NOTE_TOOLS.has(toolKey);

  if (refreshTasks && refreshNotes) {
    await loadDashboard();
    return;
  }

  if (refreshTasks) {
    const tasks = await loadTasks();
    const members = await request(API.team);
    updateDashboardStats(tasks, members);
  }

  if (refreshNotes) {
    await loadNotes();
  }
}

async function executeMCPCommand(command) {
  const text = (command || "").trim();
  if (!text) {
    toast("Enter a command first", true);
    return null;
  }

  try {
    const res = await fetch(`${API.mcp}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: text }),
    });
    const data = await res.json();
    displayMcpResult(data, text);

    if (data.success) {
      await refreshAfterMcp(data);
      toast(data.message || "Command executed");
    } else {
      toast(data.message || "Command failed", true);
    }

    return data;
  } catch (err) {
    displayMcpResult({
      success: false,
      message: err.message,
      match: { no_match: true, confidence: 0, reason: err.message },
    }, text);
    toast(err.message, true);
    return null;
  }
}

function initApp() {
  const mcpForm = document.getElementById("mcp-form");
  if (mcpForm) {
    mcpForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.getElementById("mcp-command");
      const command = input.value.trim();
      await executeMCPCommand(command);
      if (input) input.value = "";
    });
  }

  const reminderForm = document.getElementById("reminder-form");
  if (reminderForm) {
    reminderForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const title = document.getElementById("reminder-title").value.trim();
      const remindAt = document.getElementById("reminder-datetime").value;
      const assignee = document.getElementById("reminder-assignee").value;
      try {
        await addReminder({
          title,
          remind_at: remindAt,
          assigned_to: assignee ? parseInt(assignee, 10) : null,
        });
        reminderForm.reset();
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
      link.classList.add("active");

      const href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        expandSection(href.slice(1));
      }
    });
  });

  initConfirmModal();
  initSectionCollapse();
  loadDashboard().catch((err) => toast(err.message, true));
  initCreatePanels();
}

initApp();
