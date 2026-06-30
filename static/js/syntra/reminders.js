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
  return Syntra.state.reminderCache.find((entry) => entry.id === reminderId);
}

function getDefaultPageTitle() {
  if (Syntra.state.cachedDefaultTitle === null) {
    Syntra.state.cachedDefaultTitle = document.title || Syntra.constants.DEFAULT_PAGE_TITLE;
  }
  return Syntra.state.cachedDefaultTitle;
}

function getFaviconLink() {
  if (!Syntra.state.cachedFaviconLink) {
    Syntra.state.cachedFaviconLink = document.querySelector('link[rel="icon"]');
    if (Syntra.state.cachedFaviconLink) {
      Syntra.state.cachedDefaultFaviconHref = Syntra.state.cachedFaviconLink.getAttribute("href") || Syntra.constants.DEFAULT_FAVICON_HREF;
    }
  }
  return Syntra.state.cachedFaviconLink;
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
  if (Syntra.state.tabAttentionTimer) {
    clearInterval(Syntra.state.tabAttentionTimer);
    Syntra.state.tabAttentionTimer = null;
  }

  document.title = getDefaultPageTitle();
  const favicon = getFaviconLink();
  if (favicon) {
    favicon.href = Syntra.state.cachedDefaultFaviconHref;
  }
}

function startTabAttention() {
  if (Syntra.state.tabAttentionTimer) return;

  const favicon = getFaviconLink();
  let showAlert = true;

  const applyAttentionState = () => {
    document.title = showAlert
      ? `\uD83D\uDD14 Reminder — ${getDefaultPageTitle()}`
      : getDefaultPageTitle();
    if (favicon) {
      favicon.href = showAlert ? Syntra.constants.ALERT_FAVICON_HREF : Syntra.state.cachedDefaultFaviconHref;
    }
    showAlert = !showAlert;
  };

  applyAttentionState();
  Syntra.state.tabAttentionTimer = setInterval(applyAttentionState, Syntra.constants.TAB_ATTENTION_INTERVAL_MS);
}

function syncTabAttention() {
  if (shouldFlashTabForReminders()) {
    startTabAttention();
    return;
  }
  stopTabAttention();
}

function initTabAttentionListeners() {
  if (Syntra.state.tabAttentionListenersBound) return;
  Syntra.state.tabAttentionListenersBound = true;

  window.addEventListener("focus", () => syncTabAttention());
  document.addEventListener("visibilitychange", () => syncTabAttention());
}

function removeReminderPopup(reminderId) {
  Syntra.state.notifiedReminderIds.delete(reminderId);
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
      card.style.zIndex = String(1000 + Syntra.state.reminderPopupZCounter);
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

  Syntra.state.reminderPopupZCounter += 1;
  stack.querySelectorAll(".reminder-popup").forEach((entry) => {
    entry.classList.toggle("is-front", entry === card);
  });
  card.style.zIndex = String(1000 + Syntra.state.reminderPopupZCounter);
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
    ? `<span>${Syntra.core.escapeHtml(reminder.assignee_name)}</span>`
    : "";

  card.innerHTML = `
    <span class="reminder-popup-label">Reminder</span>
    <h3 class="reminder-popup-title" id="reminder-popup-title-${reminder.id}">${Syntra.core.escapeHtml(reminder.title)}</h3>
    <p class="reminder-popup-meta">
      <span>Due ${Syntra.core.escapeHtml(formatDateTime(reminder.remind_at))}</span>
      ${assigneeLine ? `<br>${assigneeLine}` : ""}
    </p>
    <div class="reminder-popup-actions">
      <div class="reminder-popup-snooze-menu">
        ${Syntra.constants.REMINDER_SNOOZE_PRESETS.map(
          (minutes) =>
            `<button type="button" class="reminder-popup-btn reminder-popup-btn--snooze" data-action="snooze" data-minutes="${minutes}">${formatSnoozeLabel(minutes)}</button>`
        ).join("")}
      </div>
      <button type="button" class="reminder-popup-btn reminder-popup-btn--dismiss" data-action="dismiss">Dismiss</button>
    </div>`;

  stack.appendChild(card);
  focusReminderPopup(reminder.id);
  syncTabAttention();
  playReminderChime();
}

async function dismissReminderPopup(reminderId) {
  const reminder = findReminderById(reminderId);
  if (!reminder) {
    removeReminderPopup(reminderId);
    return;
  }

  try {
    await Syntra.tasks.updateReminder(
      reminderId,
      {
        status: "sent",
        assigned_to: reminder.assigned_to ?? null,
      },
      { silent: true }
    );
    removeReminderPopup(reminderId);
  } catch (err) {
    Syntra.core.toast(err.message, true);
  }
}

async function snoozeReminderPopup(reminderId, minutes) {
  const reminder = findReminderById(reminderId);
  if (!reminder) {
    removeReminderPopup(reminderId);
    return;
  }

  try {
    await Syntra.tasks.updateReminder(
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
    Syntra.core.toast(err.message, true);
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
        dismissReminderPopup(reminderId).catch((err) => Syntra.core.toast(err.message, true));
        return;
      }

      if (action === "snooze") {
        const minutes = parseInt(button.dataset.minutes, 10);
        if (!minutes) return;
        snoozeReminderPopup(reminderId, minutes).catch((err) => Syntra.core.toast(err.message, true));
      }
      return;
    }

    const card = event.target.closest(".reminder-popup");
    if (!card) return;
    focusReminderPopup(parseInt(card.dataset.reminderId, 10));
  });
}

function hasPendingReminders() {
  return Syntra.state.reminderCache.some((reminder) => reminder.status === "pending");
}

function isReminderNotificationsEnabled() {
  return Boolean(Syntra.state.settingsCache?.reminder_notifications_enabled);
}

function isReminderSoundEnabled() {
  return Boolean(Syntra.state.settingsCache?.reminder_sound_enabled);
}

function updateReminderSoundToggleState() {
  const soundToggle = document.getElementById("setting-reminder-sound");
  const soundRow = document.getElementById("setting-reminder-sound-row");
  if (!soundToggle || !soundRow) return;

  const notificationsOn = isReminderNotificationsEnabled();
  soundToggle.disabled = !notificationsOn;
  soundRow.classList.toggle("is-disabled", !notificationsOn);
}

function playReminderChime() {
  if (!isReminderSoundEnabled() || !isReminderNotificationsEnabled()) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!Syntra.state.reminderAudioContext) {
      Syntra.state.reminderAudioContext = new AudioContextClass();
    }
    if (Syntra.state.reminderAudioContext.state === "suspended") {
      Syntra.state.reminderAudioContext.resume();
    }

    const start = reminderAudioContext.currentTime;
    const oscillator = reminderAudioContext.createOscillator();
    const gain = reminderAudioContext.createGain();
    oscillator.type = "sine";
    oscillator.connect(gain);
    gain.connect(Syntra.state.reminderAudioContext.destination);
    oscillator.frequency.setValueAtTime(880, start);
    oscillator.frequency.setValueAtTime(660, start + 0.12);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    oscillator.start(start);
    oscillator.stop(start + 0.35);
  } catch (_err) {
    /* ignore audio errors */
  }
}

function stopReminderAlerts() {
  if (Syntra.state.reminderPollTimer) {
    clearInterval(Syntra.state.reminderPollTimer);
    Syntra.state.reminderPollTimer = null;
  }
  if (Syntra.state.nextReminderTimer) {
    clearTimeout(Syntra.state.nextReminderTimer);
    Syntra.state.nextReminderTimer = null;
  }
  Syntra.state.notifiedReminderIds.clear();
  document.querySelectorAll(".reminder-popup").forEach((card) => card.remove());
  updateReminderPopupLayout();
  stopTabAttention();
}

function syncReminderPolling() {
  if (Syntra.state.reminderPollTimer) {
    clearInterval(Syntra.state.reminderPollTimer);
    Syntra.state.reminderPollTimer = null;
  }

  if (!isReminderNotificationsEnabled() || !hasPendingReminders()) return;

  Syntra.state.reminderPollTimer = setInterval(() => {
    refreshReminderAlerts().catch((err) => Syntra.core.toast(err.message, true));
  }, Syntra.constants.REMINDER_FAST_POLL_MS);
}

async function checkDueReminders() {
  if (!isReminderNotificationsEnabled() || !Syntra.state.reminderCache.length) return;

  const now = new Date();
  for (const reminder of Syntra.state.reminderCache) {
    if (reminder.status !== "pending") continue;
    if (Syntra.state.notifiedReminderIds.has(reminder.id)) continue;

    const remindAt = parseStoredDateTime(reminder.remind_at);
    if (!remindAt || remindAt > now) continue;

    Syntra.state.notifiedReminderIds.add(reminder.id);
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
  if (Syntra.state.nextReminderTimer) {
    clearTimeout(Syntra.state.nextReminderTimer);
    Syntra.state.nextReminderTimer = null;
  }

  if (!isReminderNotificationsEnabled() || !hasPendingReminders()) return;

  const now = Date.now();
  let delayMs = null;
  let hasUnnotifiedOverdue = false;

  for (const reminder of Syntra.state.reminderCache) {
    if (reminder.status !== "pending") continue;
    const remindAt = parseStoredDateTime(reminder.remind_at);
    if (!remindAt) continue;

    const msUntil = remindAt.getTime() - now;
    if (msUntil <= 0) {
      if (!Syntra.state.notifiedReminderIds.has(reminder.id)) {
        hasUnnotifiedOverdue = true;
      }
      continue;
    }

    delayMs = delayMs === null ? msUntil : Math.min(delayMs, msUntil);
  }

  if (hasUnnotifiedOverdue) {
    Syntra.state.nextReminderTimer = setTimeout(() => {
      Syntra.state.nextReminderTimer = null;
      refreshReminderAlerts().catch((err) => Syntra.core.toast(err.message, true));
    }, 100);
    return;
  }

  if (delayMs === null) return;

  Syntra.state.nextReminderTimer = setTimeout(() => {
    Syntra.state.nextReminderTimer = null;
    refreshReminderAlerts().catch((err) => Syntra.core.toast(err.message, true));
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
    refreshReminderAlerts().catch((err) => Syntra.core.toast(err.message, true));
    return;
  }
  stopReminderAlerts();
}

function initReminderAlerts() {
  initReminderPopupStack();
  initTabAttentionListeners();

  if (!Syntra.state.reminderVisibilityBound) {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && isReminderNotificationsEnabled()) {
        refreshReminderAlerts().catch((err) => Syntra.core.toast(err.message, true));
      }
    });
    Syntra.state.reminderVisibilityBound = true;
  }

  applyReminderAlertsState();
}

  Syntra.reminders = { requestNotificationPermission, snoozeMinutesFromNow, formatSnoozeLabel, findReminderById, getDefaultPageTitle, getFaviconLink, hasVisibleReminderPopups, shouldFlashTabForReminders, stopTabAttention, startTabAttention, syncTabAttention, initTabAttentionListeners, removeReminderPopup, updateReminderPopupLayout, focusReminderPopup, showReminderPopup, dismissReminderPopup, snoozeReminderPopup, initReminderPopupStack, hasPendingReminders, isReminderNotificationsEnabled, isReminderSoundEnabled, updateReminderSoundToggleState, playReminderChime, stopReminderAlerts, syncReminderPolling, checkDueReminders, scheduleNextReminderCheck, refreshReminderAlerts, applyReminderAlertsState, initReminderAlerts };

})(window);
