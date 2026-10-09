(function (global) {
  "use strict";
  const Syntra = global.Syntra;

  const CONFIG_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.07.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>`;

  const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  let menuEl = null;
  let activeConfigBtn = null;

  const viewState = {
    mode: "today", // "today" | "month"
    month: null, // Date set to the 1st of a month (local)
    selectedDate: null,
  };

  function escapeHtml(value) {
    return Syntra.core.escapeHtml(value == null ? "" : String(value));
  }

  function todayString() {
    return global.SyntraDateTime.localDateString();
  }

  function parseDate(dateStr) {
    const [year, month, day] = String(dateStr).split("-").map((part) => parseInt(part, 10));
    return new Date(year, month - 1, day);
  }

  function formatDayLabel(dateStr) {
    return parseDate(dateStr).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatRange(startStr, endStr) {
    const start = parseDate(startStr);
    const end = parseDate(endStr);
    const opts = { month: "short", day: "numeric" };
    if (startStr === endStr) return start.toLocaleDateString(undefined, opts);
    const left = start.toLocaleDateString(undefined, opts);
    const right = end.toLocaleDateString(undefined, { ...opts, year: "numeric" });
    return `${left} \u2013 ${right}`;
  }

  function initialsFor(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // --- Pure availability helpers ---------------------------------------

  function onLeaveOn(leaves, dateStr) {
    return (leaves || []).filter(
      (plan) => plan.start_date <= dateStr && dateStr <= plan.end_date
    );
  }

  function availableOn(members, leaves, dateStr) {
    const awayIds = new Set(onLeaveOn(leaves, dateStr).map((plan) => plan.team_member_id));
    return (members || []).filter((member) => !awayIds.has(member.id));
  }

  function dedupeByMember(plans) {
    const byMember = new Map();
    plans.forEach((plan) => {
      if (!byMember.has(plan.team_member_id)) byMember.set(plan.team_member_id, plan);
    });
    return Array.from(byMember.values());
  }

  // --- Data loading ------------------------------------------------------

  async function loadLeavePlans() {
    Syntra.state.leavePlanCache = await Syntra.core.request(Syntra.constants.API.leavePlans);
    renderIfVisible();
    return Syntra.state.leavePlanCache;
  }

  function renderIfVisible() {
    const pane = document.getElementById("team-availability-pane");
    if (pane && !pane.hidden) renderAvailability();
  }

  function findMember(memberId) {
    return Syntra.state.teamCache.find((member) => member.id === memberId);
  }

  // --- Config menu -------------------------------------------------------

  function ensureMenu() {
    if (menuEl) return menuEl;
    menuEl = document.createElement("div");
    menuEl.className = "config-menu";
    menuEl.id = "team-config-menu";
    menuEl.hidden = true;
    menuEl.setAttribute("role", "menu");
    document.body.appendChild(menuEl);
    return menuEl;
  }

  function closeMenu() {
    if (menuEl) menuEl.hidden = true;
    if (activeConfigBtn) {
      activeConfigBtn.setAttribute("aria-expanded", "false");
      activeConfigBtn = null;
    }
  }

  function openMenu(btn) {
    const member = findMember(parseInt(btn.dataset.id, 10));
    if (!member) return;
    const menu = ensureMenu();
    menu.innerHTML = `
      <button type="button" class="config-menu-item" role="menuitem" data-action="leave-new" data-id="${member.id}">Leave plan&hellip;</button>
      <button type="button" class="config-menu-item" role="menuitem" data-action="leave-list" data-id="${member.id}">Manage leaves&hellip;</button>
      <button type="button" class="config-menu-item" role="menuitem" data-action="edit" data-id="${member.id}">Edit</button>
      <button type="button" class="config-menu-item config-menu-item--danger" role="menuitem" data-action="delete" data-id="${member.id}">Delete</button>`;
    menu.hidden = false;

    const rect = btn.getBoundingClientRect();
    const width = menu.offsetWidth || 190;
    const height = menu.offsetHeight || 168;
    const viewportWidth = global.innerWidth || 1024;
    const viewportHeight = global.innerHeight || 768;
    let left = rect.right - width;
    let top = rect.bottom + 4;
    if (top + height > viewportHeight - 8) top = Math.max(8, rect.top - height - 4);
    if (left < 8) left = 8;
    if (left + width > viewportWidth - 8) left = viewportWidth - width - 8;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    btn.setAttribute("aria-expanded", "true");
    activeConfigBtn = btn;
  }

  function handleMenuAction(action, memberId) {
    const member = findMember(memberId);
    if (!member) return;
    if (action === "leave-new") openLeaveForm({ member });
    else if (action === "leave-list") openLeaveList(member);
    else if (action === "edit") Syntra.tasks.openTeamEdit(member);
    else if (action === "delete") {
      Syntra.tasks.deleteTeamMember(memberId).catch((err) => Syntra.core.toast(err.message, true));
    }
  }

  // --- Tabs & view modes -------------------------------------------------

  function switchTab(tabId) {
    document.querySelectorAll(".team-tab-btn").forEach((btn) => {
      const active = btn.dataset.tab === tabId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    const membersPane = document.getElementById("team-members-pane");
    const availabilityPane = document.getElementById("team-availability-pane");
    if (membersPane) membersPane.hidden = tabId !== "team-members-pane";
    if (availabilityPane) availabilityPane.hidden = tabId !== "team-availability-pane";
    if (tabId === "team-availability-pane") renderAvailability();
  }

  function setMode(mode) {
    viewState.mode = mode;
    document.querySelectorAll(".availability-mode-btn").forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    const todayEl = document.getElementById("availability-today");
    const monthEl = document.getElementById("availability-month-view");
    if (todayEl) todayEl.hidden = mode !== "today";
    if (monthEl) monthEl.hidden = mode !== "month";
    renderAvailability();
  }

  function shiftMonth(delta) {
    const current = viewState.month || new Date();
    viewState.month = new Date(current.getFullYear(), current.getMonth() + delta, 1);
    viewState.selectedDate = null;
    renderAvailability();
  }

  function goToTodayMonth() {
    const now = new Date();
    viewState.month = new Date(now.getFullYear(), now.getMonth(), 1);
    viewState.selectedDate = todayString();
    renderAvailability();
  }

  // --- Rendering ---------------------------------------------------------

  function renderAvailability() {
    if (viewState.mode === "today") {
      const todayEl = document.getElementById("availability-today");
      if (todayEl) renderDateLists(todayString(), todayEl);
      return;
    }
    renderMonth();
  }

  function renderDateLists(dateStr, container) {
    if (!container) return;
    const members = Syntra.state.teamCache;
    const awayPlans = dedupeByMember(onLeaveOn(Syntra.state.leavePlanCache, dateStr));
    const awayIds = new Set(awayPlans.map((plan) => plan.team_member_id));
    const available = members.filter((member) => !awayIds.has(member.id));
    const isToday = dateStr === todayString();
    const whenLabel = isToday ? "today" : `on ${formatDayLabel(dateStr)}`;

    const awayHtml = awayPlans.length
      ? awayPlans
          .map(
            (plan) => `
        <div class="availability-leave-card">
          <span class="availability-leave-name">${escapeHtml(plan.member_name || "Member")}</span>
          <span class="availability-leave-range">${escapeHtml(formatRange(plan.start_date, plan.end_date))}</span>
          ${plan.details ? `<span class="availability-leave-details">${escapeHtml(plan.details)}</span>` : ""}
        </div>`
          )
          .join("")
      : `<p class="empty">No one is on leave ${escapeHtml(whenLabel)}.</p>`;

    const availableHtml = available.length
      ? `<ul class="availability-available-list">${available
          .map((member) => `<li>${escapeHtml(member.name)}</li>`)
          .join("")}</ul>`
      : members.length
        ? `<p class="empty">Everyone is on leave ${escapeHtml(whenLabel)}.</p>`
        : `<p class="empty">No team members yet.</p>`;

    container.innerHTML = `
      <div class="availability-columns">
        <div class="availability-column">
          <h3 class="availability-column-title">On leave ${escapeHtml(whenLabel)}</h3>
          ${awayHtml}
        </div>
        <div class="availability-column">
          <h3 class="availability-column-title">Available ${escapeHtml(whenLabel)}</h3>
          ${availableHtml}
        </div>
      </div>`;
  }

  function renderMonth() {
    const gridEl = document.getElementById("availability-grid");
    const labelEl = document.getElementById("availability-month-label");
    const drillEl = document.getElementById("availability-drilldown");
    if (!gridEl || !labelEl) return;

    const month = viewState.month || new Date();
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    labelEl.textContent = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const today = todayString();
    const leaves = Syntra.state.leavePlanCache;

    let html = WEEKDAY_LABELS.map(
      (day) => `<span class="availability-weekday">${day}</span>`
    ).join("");

    for (let i = 0; i < firstWeekday; i += 1) {
      html += `<span class="availability-day is-outside" aria-hidden="true"></span>`;
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const away = dedupeByMember(onLeaveOn(leaves, dateStr));
      const classes = ["availability-day"];
      if (dateStr === today) classes.push("is-today");
      if (dateStr === viewState.selectedDate) classes.push("is-selected");
      if (away.length) classes.push("has-leave");
      const chips = away
        .map(
          (plan) =>
            `<span class="availability-chip" title="${escapeHtml(plan.member_name || "")}${plan.details ? `: ${escapeHtml(plan.details)}` : ""}">${escapeHtml(initialsFor(plan.member_name))}</span>`
        )
        .join("");
      html += `<button type="button" class="${classes.join(" ")}" data-date="${dateStr}" aria-label="${escapeHtml(formatDayLabel(dateStr))}${away.length ? `, ${away.length} on leave` : ""}">
          <span class="availability-day-number">${day}</span>
          <span class="availability-day-chips">${chips}</span>
        </button>`;
    }

    gridEl.innerHTML = html;

    if (drillEl) {
      if (viewState.selectedDate) {
        drillEl.hidden = false;
        renderDateLists(viewState.selectedDate, drillEl);
      } else {
        drillEl.hidden = true;
        drillEl.innerHTML = "";
      }
    }
  }

  // --- Leave form --------------------------------------------------------

  function populateMemberSelect(select, selectedId) {
    const members = Syntra.state.teamCache;
    select.innerHTML =
      `<option value="">Select member</option>` +
      members
        .map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`)
        .join("");
    if (selectedId != null) select.value = String(selectedId);
  }

  function openLeaveForm(options = {}) {
    const { member = null, plan = null } = options;
    if (!Syntra.state.teamCache.length) {
      Syntra.core.toast("Add a team member first", true);
      return;
    }
    const panel = document.getElementById("leave-form-panel");
    const form = document.getElementById("leave-form");
    if (!panel || !form) return;

    form.reset();
    document.getElementById("leave-edit-id").value = plan ? plan.id : "";
    populateMemberSelect(
      document.getElementById("leave-member"),
      plan ? plan.team_member_id : member ? member.id : null
    );
    document.getElementById("leave-start").value = plan ? plan.start_date : "";
    document.getElementById("leave-end").value = plan ? plan.end_date : "";
    document.getElementById("leave-details").value = plan ? plan.details || "" : "";
    const title = document.getElementById("leave-form-title");
    if (title) title.textContent = plan ? "Edit leave plan" : "Leave plan";

    Syntra.ui.toggleCreatePanel("leave-form-panel");
  }

  // --- Manage leaves panel ----------------------------------------------

  function openLeaveList(member) {
    const panel = document.getElementById("leave-list-panel");
    if (!panel) return;
    renderLeaveList(member);
    Syntra.ui.toggleCreatePanel("leave-list-panel");
  }

  function renderLeaveList(member) {
    const title = document.getElementById("leave-list-title");
    if (title) title.textContent = `Leave plans \u2014 ${member.name}`;
    const body = document.getElementById("leave-list-body");
    if (!body) return;

    const today = todayString();
    const own = Syntra.state.leavePlanCache.filter(
      (plan) => plan.team_member_id === member.id
    );
    const upcoming = own
      .filter((plan) => plan.end_date >= today)
      .sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : b.id - a.id));
    const past = own
      .filter((plan) => plan.end_date < today)
      .sort((a, b) => (a.start_date > b.start_date ? -1 : a.start_date < b.start_date ? 1 : b.id - a.id));
    const ordered = [...upcoming, ...past];

    if (!ordered.length) {
      body.innerHTML = Syntra.core.renderEmptyState(
        "No leave plans yet",
        "Use Leave plan\u2026 to record time away for this member."
      );
      return;
    }

    body.innerHTML = ordered
      .map(
        (plan) => `
      <div class="leave-row" data-id="${plan.id}">
        <div class="leave-row-main">
          <span class="leave-row-range">${escapeHtml(formatRange(plan.start_date, plan.end_date))}${plan.end_date < today ? " \u00b7 past" : ""}</span>
          ${plan.details ? `<span class="leave-row-details">${escapeHtml(plan.details)}</span>` : ""}
        </div>
        <div class="leave-row-actions">
          <button type="button" class="leave-row-edit" data-id="${plan.id}" data-member="${member.id}">Edit</button>
          <button type="button" class="leave-row-delete" data-id="${plan.id}" data-member="${member.id}">Cancel</button>
        </div>
      </div>`
      )
      .join("");
  }

  async function cancelLeavePlan(planId, memberId) {
    try {
      await Syntra.ui.deleteResource(
        `${Syntra.constants.API.leavePlans}/${planId}`,
        "leave plan",
        "",
        async () => {
          await loadLeavePlans();
          const member = findMember(memberId);
          const panel = document.getElementById("leave-list-panel");
          if (member && panel && !panel.hidden) renderLeaveList(member);
        }
      );
    } catch (err) {
      Syntra.core.toast(err.message, true);
    }
  }

  // --- Init --------------------------------------------------------------

  function initAvailability() {
    document.addEventListener("click", (event) => {
      const configBtn = event.target.closest(".row-config-btn");
      if (configBtn) {
        event.stopPropagation();
        if (activeConfigBtn === configBtn && menuEl && !menuEl.hidden) closeMenu();
        else openMenu(configBtn);
        return;
      }

      const menuItem = event.target.closest(".config-menu-item");
      if (menuItem) {
        event.stopPropagation();
        handleMenuAction(menuItem.dataset.action, parseInt(menuItem.dataset.id, 10));
        closeMenu();
        return;
      }

      if (menuEl && !menuEl.hidden) closeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });

    document.querySelectorAll(".team-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    document.querySelectorAll(".availability-mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });

    const prevBtn = document.getElementById("availability-month-prev");
    const nextBtn = document.getElementById("availability-month-next");
    const todayBtn = document.getElementById("availability-month-today");
    if (prevBtn) prevBtn.addEventListener("click", () => shiftMonth(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => shiftMonth(1));
    if (todayBtn) todayBtn.addEventListener("click", goToTodayMonth);

    const grid = document.getElementById("availability-grid");
    if (grid) {
      grid.addEventListener("click", (event) => {
        const dayBtn = event.target.closest(".availability-day[data-date]");
        if (!dayBtn) return;
        viewState.selectedDate = dayBtn.dataset.date;
        renderMonth();
      });
    }

    const leaveForm = document.getElementById("leave-form");
    if (leaveForm) {
      leaveForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const editId = document.getElementById("leave-edit-id").value;
        const memberId = document.getElementById("leave-member").value;
        const start = document.getElementById("leave-start").value;
        const end = document.getElementById("leave-end").value;
        const details = document.getElementById("leave-details").value.trim();

        if (!memberId) {
          Syntra.core.toast("Select a team member", true);
          return;
        }
        if (!start || !end) {
          Syntra.core.toast("Start and end dates are required", true);
          return;
        }
        if (end < start) {
          Syntra.core.toast("End date must be on or after the start date", true);
          return;
        }

        const payload = {
          team_member_id: parseInt(memberId, 10),
          start_date: start,
          end_date: end,
          details: details || null,
        };

        try {
          if (editId) {
            await Syntra.core.request(
              `${Syntra.constants.API.leavePlans}/${editId}`,
              { method: "PUT", body: JSON.stringify(payload) }
            );
            Syntra.core.toast("Leave plan updated");
          } else {
            await Syntra.core.request(Syntra.constants.API.leavePlans, {
              method: "POST",
              body: JSON.stringify(payload),
            });
            Syntra.core.toast("Leave plan saved");
          }
          Syntra.ui.closeCreatePanel("leave-form-panel");
          await loadLeavePlans();
        } catch (err) {
          Syntra.core.toast(err.message, true);
        }
      });
    }

    const leaveListBody = document.getElementById("leave-list-body");
    if (leaveListBody) {
      leaveListBody.addEventListener("click", (event) => {
        const editBtn = event.target.closest(".leave-row-edit");
        if (editBtn) {
          const plan = Syntra.state.leavePlanCache.find(
            (entry) => entry.id === parseInt(editBtn.dataset.id, 10)
          );
          if (plan) openLeaveForm({ plan });
          return;
        }
        const deleteBtn = event.target.closest(".leave-row-delete");
        if (deleteBtn) {
          cancelLeavePlan(
            parseInt(deleteBtn.dataset.id, 10),
            parseInt(deleteBtn.dataset.member, 10)
          );
        }
      });
    }
  }

  Syntra.availability = {
    CONFIG_ICON,
    initAvailability,
    loadLeavePlans,
    renderIfVisible,
    openLeaveForm,
    openLeaveList,
    onLeaveOn,
    availableOn,
    initialsFor,
  };
})(window);
