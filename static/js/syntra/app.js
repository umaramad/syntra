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

function initApp() {
  const mcpForm = document.getElementById("mcp-form");
  if (mcpForm) {
    mcpForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.getElementById("mcp-command");
      const command = input.value.trim();
      await Syntra.mcp.executeMCPCommand(command);
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
        await Syntra.tasks.addReminder({
          title,
          remind_at: remindAt,
          assigned_to: assignee ? parseInt(assignee, 10) : null,
        });
        reminderForm.reset();
      } catch (err) {
        Syntra.core.toast(err.message, true);
      }
    });
  }

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
      link.classList.add("active");

      const href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        Syntra.ui.expandSection(href.slice(1));
      }
    });
  });

  Syntra.core.initConfirmModal();
  Syntra.profile.initProfileModal();
  Syntra.settings.initSettings();
  Syntra.tasks.initStandupSummary();
  Syntra.settings.initOnboarding();
  Syntra.ui.initSectionCollapse();
  Syntra.ui.initSidebarToggle();
  Syntra.search.initSearch();
  Syntra.search.initTaskFilters();
  Syntra.reminders.initReminderPopupStack();
  Syntra.tasks.loadDashboard()
    .catch((err) => Syntra.core.toast(err.message, true))
    .finally(() => Syntra.reminders.initReminderAlerts());
  Syntra.tasks.initCreatePanels();
}

  Syntra.app = { initApp };

})(window);
