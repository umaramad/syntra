(function (global) {
  "use strict";

  global.Syntra = global.Syntra || {};

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
    backup: "/api/backup",
  };

  const TASK_TOOLS = new Set(["create_task", "list_tasks", "assign_task"]);
  const NOTE_TOOLS = new Set(["create_note", "list_notes"]);
  const REMINDER_FAST_POLL_MS = 3000;
  const REMINDER_SNOOZE_PRESETS = [5, 15, 60];
  const TAB_ATTENTION_INTERVAL_MS = 1000;
  const DEFAULT_PAGE_TITLE = "Syntra";
  const DEFAULT_FAVICON_HREF = "/static/images/syntra-mark.svg";
  const ALERT_FAVICON_HREF = "/static/images/syntra-mark-alert.svg";
  const VALID_THEMES = ["light", "dark", "system"];
  const THEME_STORAGE_KEY = "syntra-theme";
  const SIDEBAR_STORAGE_KEY = "syntra-sidebar-collapsed";
  const ONBOARDING_STORAGE_KEY = "syntra-onboarding-dismissed";
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
  let settingsCache = {
    reminder_notifications_enabled: false,
    reminder_sound_enabled: false,
    theme: "light",
  };
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
  let systemThemeListenerBound = false;
  let reminderAudioContext = null;
  let confirmResolver = null;

  global.Syntra.constants = {
    API,
    TASK_TOOLS,
    NOTE_TOOLS,
    REMINDER_FAST_POLL_MS,
    REMINDER_SNOOZE_PRESETS,
    TAB_ATTENTION_INTERVAL_MS,
    DEFAULT_PAGE_TITLE,
    DEFAULT_FAVICON_HREF,
    ALERT_FAVICON_HREF,
    VALID_THEMES,
    THEME_STORAGE_KEY,
    SIDEBAR_STORAGE_KEY,
    ONBOARDING_STORAGE_KEY,
    STANDUP_STATUSES,
    CONFIRM_ICONS: {},
    DELETE_ICON: "",
    COPY_ICON: "",
  };

  global.Syntra.state = {
    taskCache,
    taskGroupCache,
    archivedGroupCache,
    expandedTaskGroups,
    expandedArchivedGroups,
    expandedTaskComments,
    standupBodyCollapsed,
    taskCommentsCache,
    noteCache,
    teamCache,
    reminderCache,
    profileCache,
    settingsCache,
    searchQuery,
    taskFilters,
    notifiedReminderIds,
    reminderPollTimer,
    nextReminderTimer,
    reminderPopupZCounter,
    reminderVisibilityBound,
    tabAttentionTimer,
    tabAttentionListenersBound,
    cachedDefaultTitle,
    cachedFaviconLink,
    cachedDefaultFaviconHref,
    systemThemeListenerBound,
    reminderAudioContext,
    confirmResolver,
  };
})(window);
