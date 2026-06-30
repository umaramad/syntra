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

function getProfileInitials(name) {
  const parts = String(name || "User").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderProfileHeader() {
  const profile = Syntra.state.profileCache || { display_name: "User" };
  const avatarEl = document.getElementById("profile-avatar");
  const nameEl = document.getElementById("profile-name");
  if (avatarEl) avatarEl.textContent = getProfileInitials(profile.display_name);
  if (nameEl) nameEl.textContent = profile.display_name || "User";
}

function populateProfileTeamSelect(selectedId) {
  const select = document.getElementById("profile-team-member");
  if (!select) return;
  const options = ['<option value="">None</option>'];
  for (const member of Syntra.state.teamCache) {
    const selected = String(member.id) === String(selectedId ?? "") ? " selected" : "";
    options.push(`<option value="${member.id}"${selected}>${Syntra.core.escapeHtml(member.name)}</option>`);
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
  const profile = Syntra.state.profileCache || { display_name: "User", email: "", role: "", team_member_id: null };
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
  Syntra.state.profileCache = await Syntra.core.request(Syntra.constants.API.profile);
  renderProfileHeader();
  Syntra.search.updateMyWorkFilterButton();
  return Syntra.state.profileCache;
}
async function saveProfile(event) {
  event.preventDefault();
  const displayName = document.getElementById("profile-display-name").value.trim();
  const email = document.getElementById("profile-email").value.trim();
  const role = document.getElementById("profile-role").value.trim();
  const teamMemberId = document.getElementById("profile-team-member").value;
  const previousMemberId = Syntra.state.profileCache?.team_member_id ?? null;

  try {
    Syntra.state.profileCache = await Syntra.core.request(Syntra.constants.API.profile, {
      method: "PUT",
      body: JSON.stringify({
        display_name: displayName,
        email: email || null,
        role: role || null,
        team_member_id: teamMemberId ? parseInt(teamMemberId, 10) : null,
      }),
    });
    renderProfileHeader();
    Syntra.search.syncMyWorkFilterAfterProfileChange(previousMemberId);
    closeProfileModal();
    Syntra.core.toast("Profile saved");
  } catch (err) {
    Syntra.core.toast(err.message, true);
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

  Syntra.profile = { getProfileInitials, renderProfileHeader, populateProfileTeamSelect, closeProfileModal, openProfileModal, loadProfile, saveProfile, initProfileModal };

})(window);
