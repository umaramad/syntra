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

function setSidebarCollapsed(collapsed) {
  const app = document.getElementById("app");
  const toggle = document.getElementById("sidebar-toggle");
  if (!app) return;

  app.classList.toggle("sidebar-collapsed", collapsed);

  if (toggle) {
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    toggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
  }

  try {
    localStorage.setItem(Syntra.constants.SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch (_err) {
    /* ignore storage errors */
  }
}

function initSidebarToggle() {
  const toggle = document.getElementById("sidebar-toggle");
  if (!toggle || toggle.dataset.bound === "true") return;
  toggle.dataset.bound = "true";

  let savedCollapsed = false;
  try {
    savedCollapsed = localStorage.getItem(Syntra.constants.SIDEBAR_STORAGE_KEY) === "true";
  } catch (_err) {
    savedCollapsed = false;
  }

  setSidebarCollapsed(savedCollapsed);

  toggle.addEventListener("click", () => {
    const app = document.getElementById("app");
    const collapsed = !app?.classList.contains("sidebar-collapsed");
    setSidebarCollapsed(collapsed);
  });
}

const COPY_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
  </svg>`;
function updateDashboardStats(tasks, members) {
  document.getElementById("stat-total-tasks").textContent = tasks.length;
  document.getElementById("stat-completed").textContent =
    tasks.filter((task) => task.status === "done").length;
  document.getElementById("stat-due-today").textContent =
    tasks.filter((task) => isToday(task.due_date) && task.status !== "done" && task.status !== "cancelled").length;
  const overdueEl = document.getElementById("stat-overdue");
  if (overdueEl) {
    overdueEl.textContent = tasks.filter(
      (task) => isOverdue(task.due_date) && task.status !== "done" && task.status !== "cancelled"
    ).length;
  }
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
    const defaultCollapsed = section.dataset.defaultExpanded !== "true";
    setSectionCollapsed(section, defaultCollapsed);

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
      Syntra.tasks.syncTaskGroupNewField();
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
      ${Syntra.constants.DELETE_ICON}
    </button>`;
}

function highlightRow(id) {
  document.querySelectorAll(".editable-row.row-active").forEach((row) => {
    row.classList.remove("row-active");
  });
  document.querySelectorAll(".editable-standup-row.standup-row-active").forEach((row) => {
    row.classList.remove("standup-row-active");
  });
  const row = document.querySelector(`.editable-row[data-id="${id}"]`);
  if (row) row.classList.add("row-active");
}

function highlightStandupRow(taskId, commentId) {
  document.querySelectorAll(".editable-row.row-active").forEach((row) => {
    row.classList.remove("row-active");
  });
  document.querySelectorAll(".editable-standup-row.standup-row-active").forEach((row) => {
    row.classList.remove("standup-row-active");
  });
  const row = document.querySelector(
    `.editable-standup-row[data-task-id="${taskId}"][data-id="${commentId}"]`
  );
  if (row) row.classList.add("standup-row-active");
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

async function deleteResource(url, label, editPanelId, refresh) {
  const confirmed = await Syntra.core.confirmDialog({
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

  Syntra.core.toast(`${label.charAt(0).toUpperCase()}${label.slice(1)} deleted`);
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
    onDelete(parseInt(deleteBtn.dataset.id, 10)).catch((err) => Syntra.core.toast(err.message, true));
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

  Syntra.constants.COPY_ICON = COPY_ICON;
  Syntra.constants.DELETE_ICON = DELETE_ICON;
  Syntra.ui = { setSidebarCollapsed, initSidebarToggle, updateDashboardStats, setSectionCollapsed, expandSection, initSectionCollapse, toggleCreatePanel, closeCreatePanel, renderDeleteButton, highlightRow, highlightStandupRow, openEditPanel, deleteResource, bindEditableList };

})(window);
