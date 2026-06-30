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

function renderEmptyState(title, hint = "") {
  if (!hint) {
    return `<p class="empty">${escapeHtml(title)}</p>`;
  }
  return `
    <div class="empty-state">
      <p class="empty-state-title">${escapeHtml(title)}</p>
      <p class="empty-state-hint">${escapeHtml(hint)}</p>
    </div>`;
}

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

function closeConfirmModal(result) {
  const modal = document.getElementById("confirm-modal");
  if (!modal) return;

  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");

  if (Syntra.state.confirmResolver) {
    Syntra.state.confirmResolver(result);
    Syntra.state.confirmResolver = null;
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

    if (Syntra.state.confirmResolver) {
      closeConfirmModal(false);
    }

    Syntra.state.confirmResolver = resolve;

    dialog.className = `confirm-modal-dialog confirm-modal-dialog--${variant}`;
    if (icon) icon.innerHTML = Syntra.constants.CONFIRM_ICONS[variant] || Syntra.constants.CONFIRM_ICONS.default;
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

function formatTaskStatus(status) {
  return (status || "—").replace(/_/g, " ");
}

function normalizeSearchQuery(value) {
  return String(value || "").trim().toLowerCase();
}


  Syntra.constants.CONFIRM_ICONS = CONFIRM_ICONS;
  Syntra.core = { renderEmptyState, request, toast, closeConfirmModal, confirmDialog, initConfirmModal, escapeHtml, truncate, formatTaskStatus, normalizeSearchQuery };

})(window);
