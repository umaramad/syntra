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

function renderSettingsUI() {
  const notificationsToggle = document.getElementById("setting-reminder-notifications");
  if (notificationsToggle) {
    notificationsToggle.checked = Syntra.reminders.isReminderNotificationsEnabled();
  }

  const soundToggle = document.getElementById("setting-reminder-sound");
  if (soundToggle) {
    soundToggle.checked = Syntra.reminders.isReminderSoundEnabled();
  }
  Syntra.reminders.updateReminderSoundToggleState();

  const theme = getThemePreference();
  document.querySelectorAll('input[name="setting-theme"]').forEach((input) => {
    input.checked = input.value === theme;
  });
}

function getSystemColorScheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getThemePreference() {
  const theme = Syntra.state.settingsCache?.theme || "light";
  return Syntra.constants.VALID_THEMES.includes(theme) ? theme : "light";
}

function resolveTheme(themePreference) {
  if (themePreference === "system") return getSystemColorScheme();
  return themePreference === "dark" ? "dark" : "light";
}

function getActiveTheme() {
  return resolveTheme(getThemePreference());
}

function formatThemeAppliedMessage(themePreference) {
  if (themePreference === "system") return "System theme applied";
  return `${themePreference === "dark" ? "Dark" : "Light"} theme applied`;
}

function applyTheme(themePreference) {
  const preference = Syntra.constants.VALID_THEMES.includes(themePreference) ? themePreference : "light";
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved === "dark" ? "dark" : "";
  try {
    localStorage.setItem(Syntra.constants.THEME_STORAGE_KEY, preference);
  } catch (_err) {
    /* ignore storage errors */
  }
}

function bindSystemThemeListener() {
  if (Syntra.state.systemThemeListenerBound || !window.matchMedia) return;
  Syntra.state.systemThemeListenerBound = true;

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemePreference() === "system") {
      applyTheme("system");
    }
  });
}

async function loadSettings() {
  Syntra.state.settingsCache = await Syntra.core.request(Syntra.constants.API.settings);
  applyTheme(Syntra.state.settingsCache.theme);
  renderSettingsUI();
  return Syntra.state.settingsCache;
}

async function patchSettings(partial, options = {}) {
  const { silent = false } = options;
  Syntra.state.settingsCache = await Syntra.core.request(Syntra.constants.API.settings, {
    method: "PUT",
    body: JSON.stringify(partial),
  });
  applyTheme(Syntra.state.settingsCache.theme);
  renderSettingsUI();

  if ("reminder_notifications_enabled" in partial) {
    Syntra.reminders.applyReminderAlertsState();
  }

  if (!silent) {
    if ("theme" in partial) {
      Syntra.core.toast(formatThemeAppliedMessage(partial.theme));
    }
  }

  return Syntra.state.settingsCache;
}

async function saveReminderNotificationsSetting(enabled) {
  await patchSettings({ reminder_notifications_enabled: enabled });
  Syntra.reminders.updateReminderSoundToggleState();
  Syntra.core.toast(enabled ? "Reminder notifications enabled" : "Reminder notifications disabled");
}

async function saveReminderSoundSetting(enabled) {
  await patchSettings({ reminder_sound_enabled: enabled }, { silent: true });
  if (enabled) Syntra.reminders.playReminderChime();
  Syntra.core.toast(enabled ? "Reminder sound enabled" : "Reminder sound disabled");
}

async function saveThemeSetting(theme) {
  await patchSettings({ theme }, { silent: true });
  Syntra.core.toast(formatThemeAppliedMessage(theme));
}

async function downloadBackup() {
  const response = await fetch(`${Syntra.constants.API.backup}?download=1`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || data.message || `Backup failed (${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="(.+?)"/);
  const filename = match?.[1] || `syntra-backup-${Date.now()}.json`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function importBackup(payload) {
  return Syntra.core.request(`${Syntra.constants.API.backup}/import`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function initSettings() {
  bindSystemThemeListener();
  const toggle = document.getElementById("setting-reminder-notifications");
  if (toggle && toggle.dataset.bound !== "true") {
    toggle.dataset.bound = "true";
    toggle.addEventListener("change", () => {
      saveReminderNotificationsSetting(toggle.checked).catch((err) => {
        toggle.checked = Syntra.reminders.isReminderNotificationsEnabled();
        Syntra.reminders.updateReminderSoundToggleState();
        Syntra.core.toast(err.message, true);
      });
    });
  }

  const soundToggle = document.getElementById("setting-reminder-sound");
  if (soundToggle && soundToggle.dataset.bound !== "true") {
    soundToggle.dataset.bound = "true";
    soundToggle.addEventListener("change", () => {
      saveReminderSoundSetting(soundToggle.checked).catch((err) => {
        soundToggle.checked = Syntra.reminders.isReminderSoundEnabled();
        Syntra.core.toast(err.message, true);
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
        Syntra.core.toast(err.message, true);
      });
    });
  });

  const backupBtn = document.getElementById("settings-backup-download");
  if (backupBtn && backupBtn.dataset.bound !== "true") {
    backupBtn.dataset.bound = "true";
    backupBtn.addEventListener("click", () => {
      if (backupBtn.dataset.downloading === "true") return;
      backupBtn.dataset.downloading = "true";
      backupBtn.disabled = true;
      downloadBackup()
        .then(() => Syntra.core.toast("Backup downloaded"))
        .catch((err) => Syntra.core.toast(err.message, true))
        .finally(() => {
          backupBtn.dataset.downloading = "false";
          backupBtn.disabled = false;
        });
    });
  }

  const backupFileInput = document.getElementById("settings-backup-file");
  const backupImportBtn = document.getElementById("settings-backup-import");

  if (backupImportBtn && backupFileInput && backupImportBtn.dataset.bound !== "true") {
    backupImportBtn.dataset.bound = "true";

    backupImportBtn.addEventListener("click", () => {
      backupFileInput.click();
    });

    backupFileInput.addEventListener("change", async () => {
      const file = backupFileInput.files?.[0];
      backupFileInput.value = "";
      if (!file) return;

      let payload;
      try {
        payload = JSON.parse(await file.text());
      } catch (_err) {
        Syntra.core.toast("Invalid backup file. Choose a Syntra JSON backup.", true);
        return;
      }

      const confirmed = await Syntra.core.confirmDialog({
        title: "Import backup?",
        message:
          "This replaces all current workspace data with the backup file. Export a backup first if you want to keep today's data.",
        confirmText: "Import backup",
        cancelText: "Cancel",
        variant: "danger",
      });
      if (!confirmed) return;

      backupImportBtn.disabled = true;
      try {
        const result = await importBackup(payload);
        Object.keys(Syntra.state.taskCommentsCache).forEach((key) => {
          delete Syntra.state.taskCommentsCache[key];
        });
        await Syntra.tasks.loadDashboard();
        const totalRows = Object.values(result.tables || {}).reduce(
          (sum, count) => sum + Number(count || 0),
          0
        );
        Syntra.core.toast(`Backup imported (${totalRows} records restored)`);
      } catch (err) {
        Syntra.core.toast(err.message, true);
      } finally {
        backupImportBtn.disabled = false;
      }
    });
  }
}
function initOnboarding() {
  const banner = document.getElementById("onboarding-banner");
  if (!banner || banner.dataset.bound === "true") return;
  banner.dataset.bound = "true";

  try {
    if (localStorage.getItem(Syntra.constants.ONBOARDING_STORAGE_KEY) === "true") return;
  } catch (_err) {
    return;
  }

  banner.hidden = false;

  const dismiss = () => {
    banner.hidden = true;
    try {
      localStorage.setItem(Syntra.constants.ONBOARDING_STORAGE_KEY, "true");
    } catch (_err) {
      /* ignore storage errors */
    }
  };

  document.getElementById("onboarding-dismiss")?.addEventListener("click", dismiss);
  document.getElementById("onboarding-open-settings")?.addEventListener("click", () => {
    dismiss();
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
    const settingsLink = document.querySelector('.nav-link[href="#settings"]');
    if (settingsLink) settingsLink.classList.add("active");
    Syntra.ui.expandSection("settings");
  });
}

  Syntra.settings = { renderSettingsUI, getSystemColorScheme, getThemePreference, resolveTheme, getActiveTheme, formatThemeAppliedMessage, applyTheme, bindSystemThemeListener, loadSettings, patchSettings, saveReminderNotificationsSetting, saveReminderSoundSetting, saveThemeSetting, downloadBackup, importBackup, initSettings, initOnboarding };

})(window);
