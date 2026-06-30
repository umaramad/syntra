const API = {
  tasks: "/api/tasks",
  taskGroups: "/api/task-groups",
  archivedTaskGroups: "/api/task-groups/archived",
  notes: "/api/notes",
  team: "/api/team",
  reminders: "/api/reminders",
  mcp: "/api/mcp",
  profile: "/api/profile",
  settings: "/api/settings",
};

const {
  formatDateTime,
  toLocalDateTimeValue,
  formatDateInput,
  isToday,
  isOverdue,
  nowFormatted,
  parseStoredDateTime,
} = window.SyntraDateTime;

const TASK_TOOLS = new Set(["create_task", "list_tasks", "assign_task"]);
const NOTE_TOOLS = new Set(["create_note", "list_notes"]);
const REMINDER_FAST_POLL_MS = 3000;
const REMINDER_SNOOZE_PRESETS = [5, 15, 60];
const TAB_ATTENTION_INTERVAL_MS = 1000;
const DEFAULT_PAGE_TITLE = "Syntra";
const DEFAULT_FAVICON_HREF = "/static/images/syntra-mark.svg";
const ALERT_FAVICON_HREF = "/static/images/syntra-mark-alert.svg";
const VALID_THEMES = ["light", "dark"];
const THEME_STORAGE_KEY = "syntra-theme";
const SIDEBAR_STORAGE_KEY = "syntra-sidebar-collapsed";

const STANDUP_STATUSES = ["pending", "in_progress", "done", "cancelled"];

let taskCache = [];
let taskGroupCache = [];
let archivedGroupCache = [];
const expandedTaskGroups = new Set();
const expandedArchivedGroups = new Set();
const expandedTaskComments = new Set();
const standupBodyCollapsed = new Set();
const taskCommentsCache = {};
let noteCache = [];
let teamCache = [];
let reminderCache = [];
let profileCache = null;
let settingsCache = { reminder_notifications_enabled: false, theme: "light" };
let searchQuery = "";
const taskFilters = { status: "", priority: "", assignee: "" };
const notifiedReminderIds = new Set();
let reminderPollTimer = null;
let nextReminderTimer = null;
let reminderPopupZCounter = 0;
let reminderVisibilityBound = false;
let tabAttentionTimer = null;
let tabAttentionListenersBound = false;
let cachedDefaultTitle = null;
let cachedFaviconLink = null;
let cachedDefaultFaviconHref = DEFAULT_FAVICON_HREF;

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

function getProfileInitials(name) {
  const parts = String(name || "User").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderProfileHeader() {
  const profile = profileCache || { display_name: "User" };
  const avatarEl = document.getElementById("profile-avatar");
  const nameEl = document.getElementById("profile-name");
  if (avatarEl) avatarEl.textContent = getProfileInitials(profile.display_name);
  if (nameEl) nameEl.textContent = profile.display_name || "User";
}

function populateProfileTeamSelect(selectedId) {
  const select = document.getElementById("profile-team-member");
  if (!select) return;
  const options = ['<option value="">None</option>'];
  for (const member of teamCache) {
    const selected = String(member.id) === String(selectedId ?? "") ? " selected" : "";
    options.push(`<option value="${member.id}"${selected}>${escapeHtml(member.name)}</option>`);
  }
  select.innerHTML = options.join("");
}

function closeProfileModal() {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function openProfileModal() {
  const modal = document.getElementById("profile-modal");
  const profile = profileCache || { display_name: "User", email: "", role: "", team_member_id: null };
  if (!modal) return;

  populateProfileTeamSelect(profile.team_member_id);
  document.getElementById("profile-display-name").value = profile.display_name || "";
  document.getElementById("profile-email").value = profile.email || "";
  document.getElementById("profile-role").value = profile.role || "";
  document.getElementById("profile-team-member").value = profile.team_member_id ? String(profile.team_member_id) : "";

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  document.getElementById("profile-display-name")?.focus();
}

async function loadProfile() {
  profileCache = await request(API.profile);
  renderProfileHeader();
  return profileCache;
}

function renderSettingsUI() {
  const toggle = document.getElementById("setting-reminder-notifications");
  if (toggle) {
    toggle.checked = isReminderNotificationsEnabled();
  }

  const theme = getActiveTheme();
  document.querySelectorAll('input[name="setting-theme"]').forEach((input) => {
    input.checked = input.value === theme;
  });
}

function getActiveTheme() {
  const theme = settingsCache?.theme || "light";
  return VALID_THEMES.includes(theme) ? theme : "light";
}

function applyTheme(theme) {
  const resolved = VALID_THEMES.includes(theme) ? theme : "light";
  document.documentElement.dataset.theme = resolved === "dark" ? "dark" : "";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, resolved);
  } catch (_err) {
    /* ignore storage errors */
  }
}

async function loadSettings() {
  settingsCache = await request(API.settings);
  applyTheme(settingsCache.theme);
  renderSettingsUI();
  return settingsCache;
}

async function patchSettings(partial, options = {}) {
  const { silent = false } = options;
  settingsCache = await request(API.settings, {
    method: "PUT",
    body: JSON.stringify(partial),
  });
  applyTheme(settingsCache.theme);
  renderSettingsUI();

  if ("reminder_notifications_enabled" in partial) {
    applyReminderAlertsState();
  }

  if (!silent) {
    if ("theme" in partial) {
      toast(`${getActiveTheme() === "dark" ? "Dark" : "Light"} theme applied`);
    }
  }

  return settingsCache;
}

async function saveReminderNotificationsSetting(enabled) {
  await patchSettings({ reminder_notifications_enabled: enabled });
  toast(enabled ? "Reminder notifications enabled" : "Reminder notifications disabled");
}

async function saveThemeSetting(theme) {
  await patchSettings({ theme }, { silent: true });
  toast(`${theme === "dark" ? "Dark" : "Light"} theme applied`);
}

function initSettings() {
  const toggle = document.getElementById("setting-reminder-notifications");
  if (toggle && toggle.dataset.bound !== "true") {
    toggle.dataset.bound = "true";
    toggle.addEventListener("change", () => {
      saveReminderNotificationsSetting(toggle.checked).catch((err) => {
        toggle.checked = isReminderNotificationsEnabled();
        toast(err.message, true);
      });
    });
  }

  document.querySelectorAll('input[name="setting-theme"]').forEach((input) => {
    if (input.dataset.bound === "true") return;
    input.dataset.bound = "true";
    input.addEventListener("change", () => {
      if (!input.checked) return;
      saveThemeSetting(input.value).catch((err) => {
        renderSettingsUI();
        toast(err.message, true);
      });
    });
  });
}

async function saveProfile(event) {
  event.preventDefault();
  const displayName = document.getElementById("profile-display-name").value.trim();
  const email = document.getElementById("profile-email").value.trim();
  const role = document.getElementById("profile-role").value.trim();
  const teamMemberId = document.getElementById("profile-team-member").value;

  try {
    profileCache = await request(API.profile, {
      method: "PUT",
      body: JSON.stringify({
        display_name: displayName,
        email: email || null,
        role: role || null,
        team_member_id: teamMemberId ? parseInt(teamMemberId, 10) : null,
      }),
    });
    renderProfileHeader();
    closeProfileModal();
    toast("Profile saved");
  } catch (err) {
    toast(err.message, true);
  }
}

function initProfileModal() {
  const modal = document.getElementById("profile-modal");
  const btn = document.getElementById("profile-btn");
  const form = document.getElementById("profile-form");
  const cancelBtn = document.getElementById("profile-modal-cancel");
  if (!modal || modal.dataset.bound === "true") return;
  modal.dataset.bound = "true";

  btn?.addEventListener("click", () => openProfileModal());
  cancelBtn?.addEventListener("click", () => closeProfileModal());
  form?.addEventListener("submit", (event) => saveProfile(event));

  modal.querySelectorAll("[data-profile-dismiss]").forEach((el) => {
    el.addEventListener("click", () => closeProfileModal());
  });

  document.addEventListener("keydown", (event) => {
    if (modal.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeProfileModal();
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

function formatTaskStatus(status) {
  return (status || "—").replace(/_/g, " ");
}

function normalizeSearchQuery(value) {
  return String(value || "").trim().toLowerCase();
}

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
  const comments = taskCommentsCache[task.id] || [];
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
  let tasks = [...taskCache];

  if (taskFilters.status) {
    tasks = tasks.filter((task) => task.status === taskFilters.status);
  }

  if (taskFilters.priority === "high_plus") {
    tasks = tasks.filter((task) => task.priority === "high" || task.priority === "urgent");
  } else if (taskFilters.priority) {
    tasks = tasks.filter((task) => task.priority === taskFilters.priority);
  }

  if (taskFilters.assignee === "unassigned") {
    tasks = tasks.filter((task) => !task.assigned_to);
  } else if (taskFilters.assignee) {
    tasks = tasks.filter((task) => String(task.assigned_to) === taskFilters.assignee);
  }

  const query = normalizeSearchQuery(searchQuery);
  if (query) {
    tasks = tasks.filter((task) => taskMatchesSearch(task, query));
  }

  return tasks;
}

function getFilteredNotes() {
  const query = normalizeSearchQuery(searchQuery);
  if (!query) return noteCache;
  return noteCache.filter((note) => noteMatchesSearch(note, query));
}

function getFilteredTeam() {
  const query = normalizeSearchQuery(searchQuery);
  if (!query) return teamCache;
  return teamCache.filter((member) => memberMatchesSearch(member, query));
}

function renderDueDateCell(task) {
  if (!task.due_date) return "—";
  const dateText = formatDateInput(task.due_date);
  let className = "due-date";
  if (task.status !== "done" && task.status !== "cancelled") {
    if (isOverdue(task.due_date)) className += " due-overdue";
    else if (isToday(task.due_date)) className += " due-today";
  }
  return `<span class="${className}">${escapeHtml(dateText)}</span>`;
}

function scrollToFirstSearchMatch() {
  const query = normalizeSearchQuery(searchQuery);
  if (!query) return;

  const sections = [
    { id: "my-tasks", hasMatch: getFilteredTasks().length > 0 },
    { id: "quick-notes", hasMatch: getFilteredNotes().length > 0 },
    { id: "team-activity", hasMatch: getFilteredTeam().length > 0 },
  ];
  const firstMatch = sections.find((section) => section.hasMatch);
  if (!firstMatch) return;

  expandSection(firstMatch.id);
  document.getElementById(firstMatch.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function applyGlobalSearch() {
  renderTasksFromCache();
  renderNotesFromCache();
  renderTeamFromCache();
  scrollToFirstSearchMatch();
}

function updateTaskFilterAssigneeOptions() {
  const select = document.getElementById("task-filter-assignee");
  if (!select) return;

  const current = select.value;
  select.innerHTML =
    '<option value="">All assignees</option>' +
    '<option value="unassigned">Unassigned</option>' +
    teamCache
      .map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`)
      .join("");
  select.value = current;
}

function initSearch() {
  const input = document.querySelector(".search-box");
  if (!input || input.dataset.bound === "true") return;
  input.dataset.bound = "true";

  let debounceTimer = null;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = input.value;
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
    taskFilters.status = statusSelect.value;
    renderTasksFromCache();
  });

  prioritySelect?.addEventListener("change", () => {
    taskFilters.priority = prioritySelect.value;
    renderTasksFromCache();
  });

  assigneeSelect?.addEventListener("change", () => {
    taskFilters.assignee = assigneeSelect.value;
    renderTasksFromCache();
  });
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

function snoozeMinutesFromNow(minutes) {
  const date = new Date(Date.now() + minutes * 60_000);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatSnoozeLabel(minutes) {
  if (minutes >= 60) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function findReminderById(reminderId) {
  return reminderCache.find((entry) => entry.id === reminderId);
}

function getDefaultPageTitle() {
  if (cachedDefaultTitle === null) {
    cachedDefaultTitle = document.title || DEFAULT_PAGE_TITLE;
  }
  return cachedDefaultTitle;
}

function getFaviconLink() {
  if (!cachedFaviconLink) {
    cachedFaviconLink = document.querySelector('link[rel="icon"]');
    if (cachedFaviconLink) {
      cachedDefaultFaviconHref = cachedFaviconLink.getAttribute("href") || DEFAULT_FAVICON_HREF;
    }
  }
  return cachedFaviconLink;
}

function hasVisibleReminderPopups() {
  return document.querySelectorAll(".reminder-popup").length > 0;
}

function shouldFlashTabForReminders() {
  if (!isReminderNotificationsEnabled() || !hasVisibleReminderPopups()) {
    return false;
  }
  return document.hidden || !document.hasFocus();
}

function stopTabAttention() {
  if (tabAttentionTimer) {
    clearInterval(tabAttentionTimer);
    tabAttentionTimer = null;
  }

  document.title = getDefaultPageTitle();
  const favicon = getFaviconLink();
  if (favicon) {
    favicon.href = cachedDefaultFaviconHref;
  }
}

function startTabAttention() {
  if (tabAttentionTimer) return;

  const favicon = getFaviconLink();
  let showAlert = true;

  const applyAttentionState = () => {
    document.title = showAlert
      ? `\uD83D\uDD14 Reminder — ${getDefaultPageTitle()}`
      : getDefaultPageTitle();
    if (favicon) {
      favicon.href = showAlert ? ALERT_FAVICON_HREF : cachedDefaultFaviconHref;
    }
    showAlert = !showAlert;
  };

  applyAttentionState();
  tabAttentionTimer = setInterval(applyAttentionState, TAB_ATTENTION_INTERVAL_MS);
}

function syncTabAttention() {
  if (shouldFlashTabForReminders()) {
    startTabAttention();
    return;
  }
  stopTabAttention();
}

function initTabAttentionListeners() {
  if (tabAttentionListenersBound) return;
  tabAttentionListenersBound = true;

  window.addEventListener("focus", () => syncTabAttention());
  document.addEventListener("visibilitychange", () => syncTabAttention());
}

function removeReminderPopup(reminderId) {
  notifiedReminderIds.delete(reminderId);
  document.getElementById(`reminder-popup-${reminderId}`)?.remove();
  updateReminderPopupLayout();
  syncTabAttention();
}

function updateReminderPopupLayout() {
  const stack = document.getElementById("reminder-popup-stack");
  if (!stack) return;

  const cards = [...stack.querySelectorAll(".reminder-popup")];
  const count = cards.length;
  const offsetStep = 12;

  if (!count) {
    stack.style.width = "";
    stack.style.height = "";
    syncTabAttention();
    return;
  }

  let front = cards.find((card) => card.classList.contains("is-front"));
  if (!front) {
    front = cards[cards.length - 1];
    front.classList.add("is-front");
  }

  stack.style.width = `${280 + (count - 1) * offsetStep}px`;
  stack.style.height = `${180 + (count - 1) * offsetStep}px`;

  let backIndex = 0;
  cards.forEach((card) => {
    if (card === front) {
      card.classList.add("is-front");
      card.style.setProperty("--stack-depth", "0");
      card.style.zIndex = String(1000 + reminderPopupZCounter);
      return;
    }

    card.classList.remove("is-front");
    backIndex += 1;
    card.style.setProperty("--stack-depth", String(backIndex));
    card.style.zIndex = String(100 + backIndex);
  });
}

function focusReminderPopup(reminderId) {
  const stack = document.getElementById("reminder-popup-stack");
  const card = document.getElementById(`reminder-popup-${reminderId}`);
  if (!stack || !card) return;

  reminderPopupZCounter += 1;
  stack.querySelectorAll(".reminder-popup").forEach((entry) => {
    entry.classList.toggle("is-front", entry === card);
  });
  card.style.zIndex = String(1000 + reminderPopupZCounter);
  stack.appendChild(card);
  updateReminderPopupLayout();
}

function showReminderPopup(reminder) {
  const stack = document.getElementById("reminder-popup-stack");
  if (!stack || document.getElementById(`reminder-popup-${reminder.id}`)) return;

  const card = document.createElement("article");
  card.id = `reminder-popup-${reminder.id}`;
  card.className = "reminder-popup";
  card.setAttribute("role", "alertdialog");
  card.setAttribute("aria-labelledby", `reminder-popup-title-${reminder.id}`);
  card.dataset.reminderId = String(reminder.id);

  const assigneeLine = reminder.assignee_name
    ? `<span>${escapeHtml(reminder.assignee_name)}</span>`
    : "";

  card.innerHTML = `
    <span class="reminder-popup-label">Reminder</span>
    <h3 class="reminder-popup-title" id="reminder-popup-title-${reminder.id}">${escapeHtml(reminder.title)}</h3>
    <p class="reminder-popup-meta">
      <span>Due ${escapeHtml(formatDateTime(reminder.remind_at))}</span>
      ${assigneeLine ? `<br>${assigneeLine}` : ""}
    </p>
    <div class="reminder-popup-actions">
      <div class="reminder-popup-snooze-menu">
        ${REMINDER_SNOOZE_PRESETS.map(
          (minutes) =>
            `<button type="button" class="reminder-popup-btn reminder-popup-btn--snooze" data-action="snooze" data-minutes="${minutes}">${formatSnoozeLabel(minutes)}</button>`
        ).join("")}
      </div>
      <button type="button" class="reminder-popup-btn reminder-popup-btn--dismiss" data-action="dismiss">Dismiss</button>
    </div>`;

  stack.appendChild(card);
  focusReminderPopup(reminder.id);
  syncTabAttention();
}

async function dismissReminderPopup(reminderId) {
  const reminder = findReminderById(reminderId);
  if (!reminder) {
    removeReminderPopup(reminderId);
    return;
  }

  try {
    await updateReminder(
      reminderId,
      {
        status: "sent",
        assigned_to: reminder.assigned_to ?? null,
      },
      { silent: true }
    );
    removeReminderPopup(reminderId);
  } catch (err) {
    toast(err.message, true);
  }
}

async function snoozeReminderPopup(reminderId, minutes) {
  const reminder = findReminderById(reminderId);
  if (!reminder) {
    removeReminderPopup(reminderId);
    return;
  }

  try {
    await updateReminder(
      reminderId,
      {
        remind_at: snoozeMinutesFromNow(minutes),
        status: "pending",
        assigned_to: reminder.assigned_to ?? null,
      },
      { silent: true }
    );
    removeReminderPopup(reminderId);
  } catch (err) {
    toast(err.message, true);
  }
}

function initReminderPopupStack() {
  const stack = document.getElementById("reminder-popup-stack");
  if (!stack || stack.dataset.bound === "true") return;
  stack.dataset.bound = "true";

  stack.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button) {
      const card = button.closest(".reminder-popup");
      if (!card) return;

      const reminderId = parseInt(card.dataset.reminderId, 10);
      const action = button.dataset.action;

      if (action === "dismiss") {
        dismissReminderPopup(reminderId).catch((err) => toast(err.message, true));
        return;
      }

      if (action === "snooze") {
        const minutes = parseInt(button.dataset.minutes, 10);
        if (!minutes) return;
        snoozeReminderPopup(reminderId, minutes).catch((err) => toast(err.message, true));
      }
      return;
    }

    const card = event.target.closest(".reminder-popup");
    if (!card) return;
    focusReminderPopup(parseInt(card.dataset.reminderId, 10));
  });
}

function hasPendingReminders() {
  return reminderCache.some((reminder) => reminder.status === "pending");
}

function isReminderNotificationsEnabled() {
  return Boolean(settingsCache?.reminder_notifications_enabled);
}

function stopReminderAlerts() {
  if (reminderPollTimer) {
    clearInterval(reminderPollTimer);
    reminderPollTimer = null;
  }
  if (nextReminderTimer) {
    clearTimeout(nextReminderTimer);
    nextReminderTimer = null;
  }
  notifiedReminderIds.clear();
  document.querySelectorAll(".reminder-popup").forEach((card) => card.remove());
  updateReminderPopupLayout();
  stopTabAttention();
}

function syncReminderPolling() {
  if (reminderPollTimer) {
    clearInterval(reminderPollTimer);
    reminderPollTimer = null;
  }

  if (!isReminderNotificationsEnabled() || !hasPendingReminders()) return;

  reminderPollTimer = setInterval(() => {
    refreshReminderAlerts().catch((err) => toast(err.message, true));
  }, REMINDER_FAST_POLL_MS);
}

async function checkDueReminders() {
  if (!isReminderNotificationsEnabled() || !reminderCache.length) return;

  const now = new Date();
  for (const reminder of reminderCache) {
    if (reminder.status !== "pending") continue;
    if (notifiedReminderIds.has(reminder.id)) continue;

    const remindAt = parseStoredDateTime(reminder.remind_at);
    if (!remindAt || remindAt > now) continue;

    notifiedReminderIds.add(reminder.id);
    showReminderPopup(reminder);

    if (
      document.hidden &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("Syntra Reminder", { body: reminder.title });
    }
  }
}

function scheduleNextReminderCheck() {
  if (nextReminderTimer) {
    clearTimeout(nextReminderTimer);
    nextReminderTimer = null;
  }

  if (!isReminderNotificationsEnabled() || !hasPendingReminders()) return;

  const now = Date.now();
  let delayMs = null;
  let hasUnnotifiedOverdue = false;

  for (const reminder of reminderCache) {
    if (reminder.status !== "pending") continue;
    const remindAt = parseStoredDateTime(reminder.remind_at);
    if (!remindAt) continue;

    const msUntil = remindAt.getTime() - now;
    if (msUntil <= 0) {
      if (!notifiedReminderIds.has(reminder.id)) {
        hasUnnotifiedOverdue = true;
      }
      continue;
    }

    delayMs = delayMs === null ? msUntil : Math.min(delayMs, msUntil);
  }

  if (hasUnnotifiedOverdue) {
    nextReminderTimer = setTimeout(() => {
      nextReminderTimer = null;
      refreshReminderAlerts().catch((err) => toast(err.message, true));
    }, 100);
    return;
  }

  if (delayMs === null) return;

  nextReminderTimer = setTimeout(() => {
    nextReminderTimer = null;
    refreshReminderAlerts().catch((err) => toast(err.message, true));
  }, Math.min(Math.max(delayMs + 200, 500), 10000));
}

async function refreshReminderAlerts() {
  if (!isReminderNotificationsEnabled()) {
    stopReminderAlerts();
    return;
  }
  await checkDueReminders();
  scheduleNextReminderCheck();
  syncReminderPolling();
}

function applyReminderAlertsState() {
  if (isReminderNotificationsEnabled()) {
    requestNotificationPermission().catch(() => {});
    refreshReminderAlerts().catch((err) => toast(err.message, true));
    return;
  }
  stopReminderAlerts();
}

function initReminderAlerts() {
  initReminderPopupStack();
  initTabAttentionListeners();

  if (!reminderVisibilityBound) {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && isReminderNotificationsEnabled()) {
        refreshReminderAlerts().catch((err) => toast(err.message, true));
      }
    });
    reminderVisibilityBound = true;
  }

  applyReminderAlertsState();
}

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
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
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
    savedCollapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
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

function renderTaskGroupCopyButton(groupId, groupName, source = "active") {
  return `<button type="button" class="task-group-copy-btn" data-group-id="${groupId}" data-group-name="${escapeHtml(groupName)}" data-group-source="${source}" aria-label="Copy group tasks" title="Copy tasks with comments">${COPY_ICON}</button>`;
}

async function ensureTaskComments(taskId) {
  if (taskCommentsCache[taskId]) return taskCommentsCache[taskId];
  const comments = await request(`${API.tasks}/${taskId}/comments`);
  taskCommentsCache[taskId] = comments;
  return comments;
}

function formatCommentsPlain(comments) {
  if (!comments?.length) return "—";
  return comments
    .map((entry) => {
      const member = entry.assignee_name || "—";
      const status = formatTaskStatus(entry.status);
      const time = formatDateTime(entry.created_at);
      return `${member} | ${status} | ${time}: ${entry.comment}`;
    })
    .join("\n");
}

function formatCommentsHtml(comments) {
  if (!comments?.length) return "—";
  return comments
    .map(
      (entry) =>
        `<div style="margin:0 0 6px 0;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">` +
        `<span style="font-weight:600;color:#374151;">${escapeHtml(entry.assignee_name || "—")}</span> · ` +
        `<span style="color:#6b7280;">${escapeHtml(formatTaskStatus(entry.status))}</span> · ` +
        `<span style="color:#6b7280;font-size:10pt;">${escapeHtml(formatDateTime(entry.created_at))}</span><br/>` +
        `<span style="color:#374151;">${escapeHtml(entry.comment)}</span></div>`
    )
    .join("");
}

function renderStandupStatusOptions(selected = "in_progress") {
  return STANDUP_STATUSES.map(
    (status) =>
      `<option value="${status}"${status === selected ? " selected" : ""}>${escapeHtml(formatTaskStatus(status))}</option>`
  ).join("");
}

function renderStandupMemberOptions(selectedId) {
  const options = ['<option value="">Select member</option>'];
  for (const member of teamCache) {
    const selected = String(member.id) === String(selectedId ?? "") ? " selected" : "";
    options.push(`<option value="${member.id}"${selected}>${escapeHtml(member.name)}</option>`);
  }
  return options.join("");
}

function getDefaultStandupMemberId(task) {
  if (profileCache?.team_member_id) return profileCache.team_member_id;
  if (task?.assigned_to) return task.assigned_to;
  return "";
}

function updateStandupPanelHeader(taskId, count) {
  const titleEl = document.querySelector(`#task-comments-${taskId} .standup-panel-title`);
  if (titleEl) titleEl.textContent = `Standup updates (${count})`;
}

function buildGroupTasksClipboardPlain(groupName, tasks, commentsByTaskId) {
  const exportedAt = nowFormatted();
  const header = `${groupName}\nExported from Syntra on ${exportedAt}\n`;
  const columns = ["Title", "Status", "Priority", "Assigned To", "Comments"];
  const rows = tasks.map((task) => [
    task.title || "—",
    formatTaskStatus(task.status),
    task.priority || "—",
    task.assignee_name || "—",
    formatCommentsPlain(commentsByTaskId[task.id]),
  ]);

  const colWidths = columns.map((col, index) =>
    Math.max(col.length, ...rows.map((row) => String(row[index]).split("\n")[0].length))
  );

  const formatRow = (cells) =>
    cells.map((cell, index) => String(cell).padEnd(colWidths[index])).join("  ");

  const divider = colWidths.map((width) => "-".repeat(width)).join("  ");
  const body = rows
    .map((row) => {
      const firstLine = formatRow(row.map((cell) => String(cell).split("\n")[0]));
      const commentLines = String(row[4]).split("\n").slice(1);
      if (!commentLines.length) return firstLine;
      const indent = " ".repeat(colWidths.slice(0, 4).reduce((sum, width) => sum + width + 2, 0));
      return [firstLine, ...commentLines.map((line) => indent + line)].join("\n");
    })
    .join("\n");

  return `${header}\n${formatRow(columns)}\n${divider}\n${body}`;
}

function buildGroupTasksClipboardHtml(groupName, tasks, commentsByTaskId) {
  const exportedAt = nowFormatted();
  const headerCells = ["Title", "Status", "Priority", "Assigned To", "Comments"]
    .map(
      (label) =>
        `<th style="border:1px solid #2f5597;background-color:#4472c4;color:#ffffff;padding:8px 10px;text-align:left;font-size:11pt;">${label}</th>`
    )
    .join("");

  const bodyRows = tasks
    .map((task, index) => {
      const rowBg = index % 2 === 0 ? "#ffffff" : "#f3f6fb";
      const cellStyle =
        "border:1px solid #bfbfbf;padding:8px 10px;vertical-align:top;font-size:11pt;color:#111827;";
      return `<tr style="background-color:${rowBg};">
        <td style="${cellStyle}">${escapeHtml(task.title || "—")}</td>
        <td style="${cellStyle}">${escapeHtml(formatTaskStatus(task.status))}</td>
        <td style="${cellStyle}">${escapeHtml(task.priority || "—")}</td>
        <td style="${cellStyle}">${escapeHtml(task.assignee_name || "—")}</td>
        <td style="${cellStyle}">${formatCommentsHtml(commentsByTaskId[task.id])}</td>
      </tr>`;
    })
    .join("");

  const fragment = `
    <div style="font-family:Calibri,Arial,sans-serif;color:#111827;">
      <p style="margin:0 0 4px 0;font-size:14pt;font-weight:700;">${escapeHtml(groupName)}</p>
      <p style="margin:0 0 12px 0;font-size:10pt;color:#6b7280;">Exported from Syntra on ${escapeHtml(exportedAt)}</p>
      <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:960px;font-family:Calibri,Arial,sans-serif;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;

  return `<!DOCTYPE html><html><body><!--StartFragment-->${fragment}<!--EndFragment--></body></html>`;
}

async function copyHtmlToClipboard(html, plainText) {
  if (navigator.clipboard?.write && window.ClipboardItem) {
    const htmlBlob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([plainText], { type: "text/plain" });
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      }),
    ]);
    return;
  }

  const container = document.createElement("div");
  container.contentEditable = "true";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.innerHTML = html;
  document.body.appendChild(container);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(container);
  selection.removeAllRanges();
  selection.addRange(range);

  const copied = document.execCommand("copy");
  selection.removeAllRanges();
  document.body.removeChild(container);

  if (!copied) {
    await navigator.clipboard.writeText(plainText);
  }
}

async function copyTaskGroup(groupId, groupName, source = "active") {
  const tasks =
    source === "archived"
      ? archivedGroupCache.find((group) => group.id === groupId)?.tasks || []
      : taskCache.filter((task) => task.group_id === groupId);

  if (!tasks.length) {
    toast("No tasks to copy");
    return;
  }

  const commentsEntries = await Promise.all(
    tasks.map(async (task) => [task.id, await ensureTaskComments(task.id)])
  );
  const commentsByTaskId = Object.fromEntries(commentsEntries);
  const html = buildGroupTasksClipboardHtml(groupName, tasks, commentsByTaskId);
  const plain = buildGroupTasksClipboardPlain(groupName, tasks, commentsByTaskId);

  await copyHtmlToClipboard(html, plain);
  toast(`"${groupName}" copied to clipboard`);
}

function handleTaskGroupCopyClick(button) {
  if (button.dataset.copying === "true") return;
  button.dataset.copying = "true";
  button.disabled = true;
  copyTaskGroup(
    parseInt(button.dataset.groupId, 10),
    button.dataset.groupName,
    button.dataset.groupSource || "active"
  )
    .catch((err) => toast(err.message, true))
    .finally(() => {
      button.dataset.copying = "false";
      button.disabled = false;
    });
}

function updateAssigneeOptions(members) {
  const assignOptions =
    '<option value="">Assign to team member</option>' +
    members.map((member) =>
      `<option value="${member.id}">${escapeHtml(member.name)}</option>`
    ).join("");

  ["reminder-assignee", "reminder-edit-assignee", "task-assignee", "task-edit-assignee"].forEach((id) => {
    const select = document.getElementById(id);
    if (select) select.innerHTML = assignOptions;
  });

  const standupEditMember = document.getElementById("standup-edit-member");
  if (standupEditMember) {
    standupEditMember.innerHTML =
      '<option value="">Select member</option>' +
      members.map((member) =>
        `<option value="${member.id}">${escapeHtml(member.name)}</option>`
      ).join("");
  }
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
  const groupActions =
    group.id
      ? `<div class="task-group-actions">
          ${renderTaskGroupCopyButton(group.id, groupName, "active")}
          ${
            showArchive
              ? `<button type="button" class="task-group-archive-btn" data-group-id="${group.id}" data-group-name="${escapeHtml(groupName)}" aria-label="Archive group" title="Archive group">Archive</button>`
              : ""
          }
        </div>`
      : "";

  return `
    <div class="task-group-block${isCollapsed ? " is-collapsed" : ""}" data-group-key="${groupKey}" data-group-prefix="${escapeHtml(groupKeyPrefix)}">
      <div class="task-group-header-row">
        <button type="button" class="task-group-header" aria-expanded="${!isCollapsed}">
          <span class="task-group-chevron" aria-hidden="true"></span>
          <span class="task-group-name">${escapeHtml(groupName)}</span>
          <span class="task-group-count">${groupTasks.length}</span>
        </button>
        ${groupActions}
      </div>
      <div class="task-group-body"${isCollapsed ? " hidden" : ""}>
        <table>
          <thead>
            <tr>
              <th class="done-col"></th><th>Title</th><th>Status</th><th>Priority</th><th>Assigned To</th><th>Due</th><th></th>
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
          ${renderTaskGroupCopyButton(group.id, groupName, "archived")}
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
    const copyBtn = event.target.closest(".task-group-copy-btn");
    if (copyBtn) {
      event.stopPropagation();
      handleTaskGroupCopyClick(copyBtn);
      return;
    }

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
    const copyBtn = event.target.closest(".task-group-copy-btn");
    if (copyBtn) {
      event.stopPropagation();
      handleTaskGroupCopyClick(copyBtn);
      return;
    }

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
  const bodyCollapsed = standupBodyCollapsed.has(task.id);
  const commentCount = task.comment_count || 0;
  const isDone = task.status === "done";
  const query = normalizeSearchQuery(searchQuery);
  const isSearchMatch = query && taskMatchesSearch(task, query);
  const defaultMemberId = getDefaultStandupMemberId(task);

  return `
    <tr class="editable-row${isDone ? " is-done" : ""}${isSearchMatch ? " search-match" : ""}" data-id="${task.id}" title="Double-click to edit">
      <td class="done-col">
        <button type="button" class="task-done-toggle${isDone ? " is-done" : ""}" data-id="${task.id}" aria-label="${isDone ? "Mark as pending" : "Mark as done"}" title="${isDone ? "Mark as pending" : "Mark as done"}">${isDone ? "✓" : ""}</button>
      </td>
      <td class="task-title-cell">${escapeHtml(task.title)}</td>
      <td><span class="status status-${task.status}">${task.status.replace("_", " ")}</span></td>
      <td>${escapeHtml(task.priority || "—")}</td>
      <td>${escapeHtml(task.assignee_name || "—")}</td>
      <td>${renderDueDateCell(task)}</td>
      <td class="actions-cell">
        <button type="button" class="task-comments-btn" data-id="${task.id}" aria-label="View standup updates" title="Standup updates">
          <span class="task-comments-icon" aria-hidden="true">💬</span>
          <span class="task-comments-count" id="task-comment-count-${task.id}">${commentCount}</span>
        </button>
        ${renderDeleteButton(task.id, "task")}
      </td>
    </tr>
    <tr class="task-comments-row" id="task-comments-${task.id}"${commentsOpen ? "" : " hidden"}>
      <td colspan="7">
        <div class="task-comments-panel standup-panel" data-task-id="${task.id}">
          <div class="standup-panel-header">
            <button type="button" class="standup-panel-toggle" data-task-id="${task.id}" aria-expanded="${String(!bodyCollapsed)}">
              <span class="standup-panel-title">Standup updates (${commentCount})</span>
              <span class="standup-panel-chevron${bodyCollapsed ? " is-collapsed" : ""}" aria-hidden="true">▼</span>
            </button>
          </div>
          <div class="standup-panel-body" id="standup-panel-body-${task.id}"${bodyCollapsed ? " hidden" : ""}>
            <div class="standup-table-wrap" id="task-comments-list-${task.id}">
              ${commentsOpen ? '<p class="standup-empty">Loading updates...</p>' : ""}
            </div>
            <form class="standup-form task-comment-form" data-task-id="${task.id}">
              <select class="standup-member-select" name="assigned_to" required aria-label="Team member">
                ${renderStandupMemberOptions(defaultMemberId)}
              </select>
              <select class="standup-status-select" name="status" aria-label="Status">
                ${renderStandupStatusOptions("in_progress")}
              </select>
              <input type="text" class="standup-comment-input" name="comment" placeholder="Add standup update..." required>
              <button type="submit" class="inline-submit">Post</button>
            </form>
          </div>
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

  updateStandupPanelHeader(taskId, comments.length);

  if (!comments.length) {
    listEl.innerHTML = '<p class="standup-empty">No standup updates yet. Add one below.</p>';
    return;
  }

  listEl.innerHTML = `
    <table class="standup-table">
      <thead>
        <tr>
          <th>Member</th>
          <th>Status</th>
          <th>Update</th>
          <th>Time</th>
          <th class="standup-actions-cell"></th>
        </tr>
      </thead>
      <tbody>
        ${comments.map((entry) => `
          <tr class="editable-standup-row" data-task-id="${taskId}" data-id="${entry.id}" title="Double-click to edit">
            <td>${escapeHtml(entry.assignee_name || "—")}</td>
            <td><span class="status status-${entry.status || "in_progress"}">${escapeHtml(formatTaskStatus(entry.status))}</span></td>
            <td class="standup-update-cell">${escapeHtml(entry.comment)}</td>
            <td class="standup-time-cell">${escapeHtml(formatDateTime(entry.created_at))}</td>
            <td class="standup-actions-cell">
              <button type="button" class="task-comment-delete" data-task-id="${taskId}" data-id="${entry.id}" aria-label="Delete update" title="Delete">×</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function toggleStandupBody(taskId) {
  const body = document.getElementById(`standup-panel-body-${taskId}`);
  const toggle = document.querySelector(`.standup-panel-toggle[data-task-id="${taskId}"]`);
  const chevron = toggle?.querySelector(".standup-panel-chevron");
  if (!body) return;

  const willCollapse = !body.hidden;
  body.hidden = willCollapse;
  if (willCollapse) {
    standupBodyCollapsed.add(taskId);
  } else {
    standupBodyCollapsed.delete(taskId);
  }

  if (toggle) toggle.setAttribute("aria-expanded", String(!willCollapse));
  if (chevron) chevron.classList.toggle("is-collapsed", willCollapse);
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
  standupBodyCollapsed.delete(taskId);
  const body = document.getElementById(`standup-panel-body-${taskId}`);
  const toggle = document.querySelector(`.standup-panel-toggle[data-task-id="${taskId}"]`);
  const chevron = toggle?.querySelector(".standup-panel-chevron");
  if (body) body.hidden = false;
  if (toggle) toggle.setAttribute("aria-expanded", "true");
  if (chevron) chevron.classList.remove("is-collapsed");
  await loadTaskComments(taskId);
}

async function addTaskComment(taskId, payload) {
  const entry = await request(`${API.tasks}/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({
      comment: payload.comment,
      status: payload.status || "in_progress",
      assigned_to: payload.assigned_to,
      author_name: profileCache?.display_name || "User",
    }),
  });
  taskCommentsCache[taskId] = [...(taskCommentsCache[taskId] || []), entry];
  renderTaskCommentsList(taskId, taskCommentsCache[taskId]);
  updateTaskCommentCount(taskId, taskCommentsCache[taskId].length);
  toast("Standup update posted");
  return entry;
}

async function deleteTaskComment(taskId, commentId) {
  const confirmed = await confirmDialog({
    title: "Delete update?",
    message: "This standup update will be permanently removed.",
    confirmText: "Delete",
    variant: "danger",
  });
  if (!confirmed) return;

  await request(`${API.tasks}/${taskId}/comments/${commentId}`, { method: "DELETE" });
  taskCommentsCache[taskId] = (taskCommentsCache[taskId] || []).filter((item) => item.id !== commentId);
  renderTaskCommentsList(taskId, taskCommentsCache[taskId]);
  updateTaskCommentCount(taskId, taskCommentsCache[taskId].length);
  closeCreatePanel("standup-edit-panel");
  toast("Standup update deleted");
}

async function updateStandupComment(taskId, commentId, payload) {
  const entry = await request(`${API.tasks}/${taskId}/comments/${commentId}`, {
    method: "PUT",
    body: JSON.stringify({
      comment: payload.comment,
      status: payload.status || "in_progress",
      assigned_to: payload.assigned_to,
    }),
  });
  taskCommentsCache[taskId] = (taskCommentsCache[taskId] || []).map((item) =>
    item.id === commentId ? entry : item
  );
  renderTaskCommentsList(taskId, taskCommentsCache[taskId]);
  closeCreatePanel("standup-edit-panel");
  toast("Standup update saved");
  return entry;
}

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

function openTaskEdit(task) {
  closeCreatePanel("task-create-panel");
  closeCreatePanel("standup-edit-panel");
  document.getElementById("task-edit-id").value = task.id;
  document.getElementById("task-edit-title").value = task.title || "";
  document.getElementById("task-edit-group").value = task.group_id || "";
  document.getElementById("task-edit-assignee").value = task.assigned_to || "";
  document.getElementById("task-edit-status").value = task.status || "pending";
  document.getElementById("task-edit-priority").value = task.priority || "medium";
  document.getElementById("task-edit-due").value = formatDateInput(task.due_date);
  highlightRow(task.id);
  openEditPanel("task-edit-panel", "task-edit-title");
}

function openStandupEdit(taskId, comment) {
  closeCreatePanel("task-create-panel");
  closeCreatePanel("task-edit-panel");
  document.getElementById("standup-edit-task-id").value = taskId;
  document.getElementById("standup-edit-id").value = comment.id;
  document.getElementById("standup-edit-member").value = comment.assigned_to || "";
  document.getElementById("standup-edit-status").value = comment.status || "in_progress";
  document.getElementById("standup-edit-comment").value = comment.comment || "";
  highlightStandupRow(taskId, comment.id);
  openEditPanel("standup-edit-panel", "standup-edit-comment");
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

async function markTaskDone(taskId, done) {
  if (done) {
    await request(`${API.tasks}/${taskId}/done`, { method: "POST" });
    toast("Task marked done");
  } else {
    await request(`${API.tasks}/${taskId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "pending" }),
    });
    toast("Task marked pending");
  }
  const tasks = await loadTasks();
  updateDashboardStats(tasks, teamCache);
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

async function updateReminder(reminderId, payload, options = {}) {
  const { silent = false } = options;
  const reminder = await request(`${API.reminders}/${reminderId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!silent) {
    toast("Reminder updated");
    closeCreatePanel("reminder-edit-panel");
  }
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
    const doneBtn = event.target.closest(".task-done-toggle");
    if (doneBtn) {
      event.stopPropagation();
      const taskId = parseInt(doneBtn.dataset.id, 10);
      const task = taskCache.find((entry) => entry.id === taskId);
      const willMarkDone = task?.status !== "done";
      markTaskDone(taskId, willMarkDone).catch((err) => toast(err.message, true));
      return;
    }

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
      return;
    }

    const standupToggle = event.target.closest(".standup-panel-toggle");
    if (standupToggle) {
      event.stopPropagation();
      toggleStandupBody(parseInt(standupToggle.dataset.taskId, 10));
    }
  });

  container.addEventListener("dblclick", (event) => {
    if (event.target.closest(".row-delete-btn, .task-done-toggle, .task-comments-btn, .task-comment-delete, .task-comment-form, .standup-panel-toggle")) {
      return;
    }

    const standupRow = event.target.closest(".editable-standup-row");
    if (standupRow) {
      event.stopPropagation();
      const taskId = parseInt(standupRow.dataset.taskId, 10);
      const commentId = parseInt(standupRow.dataset.id, 10);
      const comment = (taskCommentsCache[taskId] || []).find((entry) => entry.id === commentId);
      if (comment) openStandupEdit(taskId, comment);
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
    const comment = form.querySelector('[name="comment"]')?.value.trim();
    const status = form.querySelector('[name="status"]')?.value || "in_progress";
    const assignedTo = form.querySelector('[name="assigned_to"]')?.value;
    if (!comment) return;
    if (!assignedTo) {
      toast("Select a team member", true);
      return;
    }
    addTaskComment(taskId, {
      comment,
      status,
      assigned_to: parseInt(assignedTo, 10),
    })
      .then(() => {
        const commentInput = form.querySelector('[name="comment"]');
        if (commentInput) commentInput.value = "";
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
          due_date: document.getElementById("task-due").value || null,
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

  const standupEditForm = document.getElementById("standup-edit-form");
  if (standupEditForm) {
    standupEditForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const taskId = parseInt(document.getElementById("standup-edit-task-id").value, 10);
      const commentId = parseInt(document.getElementById("standup-edit-id").value, 10);
      const assignedTo = document.getElementById("standup-edit-member").value;
      const comment = document.getElementById("standup-edit-comment").value.trim();
      if (!assignedTo) {
        toast("Select a team member", true);
        return;
      }
      try {
        await updateStandupComment(taskId, commentId, {
          comment,
          status: document.getElementById("standup-edit-status").value,
          assigned_to: parseInt(assignedTo, 10),
        });
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  bindTaskListEvents();
  bindTaskGroupEvents();
  bindArchiveGroupEvents();
  initTaskFilters();
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
  taskCache = await request(API.tasks);
  renderTasksFromCache();
  return taskCache;
}

function renderTasksFromCache() {
  const container = document.getElementById("tasks-list");
  if (!container) return;

  const tasks = getFilteredTasks();
  const hasFilters =
    taskFilters.status || taskFilters.priority || taskFilters.assignee || normalizeSearchQuery(searchQuery);

  if (!taskCache.length) {
    container.innerHTML = '<p class="empty">No tasks yet. Click + to add one.</p>';
    return;
  }

  if (!tasks.length) {
    container.innerHTML = `<p class="empty">${hasFilters ? "No tasks match your filters or search." : "No tasks yet. Click + to add one."}</p>`;
    return;
  }

  container.innerHTML = groupTasksByGroup(tasks)
    .map((group) => renderTaskGroupBlock(group, { showArchive: Boolean(group.id) }))
    .join("");

  expandedTaskComments.forEach((taskId) => {
    if (document.getElementById(`task-comments-${taskId}`)) {
      loadTaskComments(taskId).catch((err) => toast(err.message, true));
    }
  });
}

async function loadNotes() {
  noteCache = await request(API.notes);
  renderNotesFromCache();
  return noteCache;
}

function renderNotesFromCache() {
  const container = document.getElementById("notes-list");
  if (!container) return;

  const notes = getFilteredNotes();
  const query = normalizeSearchQuery(searchQuery);

  if (!noteCache.length) {
    container.innerHTML = '<p class="empty">No notes yet. Click + to add one.</p>';
    return;
  }

  if (!notes.length) {
    container.innerHTML = '<p class="empty">No notes match your search.</p>';
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr><th>Title</th><th>Content</th><th>Updated</th><th></th></tr>
      </thead>
      <tbody>
        ${notes.map((note) => `
          <tr class="editable-row${query && noteMatchesSearch(note, query) ? " search-match" : ""}" data-id="${note.id}" title="Double-click to edit">
            <td>${escapeHtml(note.title)}</td>
            <td>${escapeHtml(truncate(note.content, 80))}</td>
            <td>${escapeHtml(formatDateTime(note.updated_at || note.created_at))}</td>
            <td class="actions-cell">${renderDeleteButton(note.id, "note")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

async function loadTeam() {
  teamCache = await request(API.team);
  updateAssigneeOptions(teamCache);
  updateTaskFilterAssigneeOptions();
  renderTeamFromCache();
  return teamCache;
}

function renderTeamFromCache() {
  const container = document.getElementById("team-list");
  if (!container) return;

  const members = getFilteredTeam();
  const query = normalizeSearchQuery(searchQuery);

  if (!teamCache.length) {
    container.innerHTML = '<p class="empty">No team members yet. Click + to add one.</p>';
    return;
  }

  if (!members.length) {
    container.innerHTML = '<p class="empty">No team members match your search.</p>';
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${members.map((member) => `
          <tr class="editable-row${query && memberMatchesSearch(member, query) ? " search-match" : ""}" data-id="${member.id}" title="Double-click to edit">
            <td>${escapeHtml(member.name)}</td>
            <td>${escapeHtml(member.role || "—")}</td>
            <td>${escapeHtml(member.email || "—")}</td>
            <td>${escapeHtml(member.status || "—")}</td>
            <td class="actions-cell">${renderDeleteButton(member.id, "team member")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

async function loadReminders() {
  const reminders = await request(API.reminders);
  reminderCache = reminders;
  const container = document.getElementById("reminders-list");
  if (!container) {
    await refreshReminderAlerts();
    return reminders;
  }

  if (!reminders.length) {
    container.innerHTML = '<p class="empty">No reminders yet. Add one above.</p>';
    await refreshReminderAlerts();
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
  await refreshReminderAlerts();
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
  await loadSettings();
  const [tasks, , members] = await Promise.all([
    loadTasks(),
    loadNotes(),
    loadTeam(),
    loadReminders(),
    loadTaskGroups(),
    loadArchivedGroups(),
    loadProfile(),
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
  initProfileModal();
  initSettings();
  initSectionCollapse();
  initSidebarToggle();
  initSearch();
  initTaskFilters();
  initReminderPopupStack();
  loadDashboard()
    .catch((err) => toast(err.message, true))
    .finally(() => initReminderAlerts());
  initCreatePanels();
}

initApp();
