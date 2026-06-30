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

function renderTaskGroupCopyButton(groupId, groupName, source = "active") {
  return `<button type="button" class="task-group-copy-btn" data-group-id="${groupId}" data-group-name="${Syntra.core.escapeHtml(groupName)}" data-group-source="${source}" aria-label="Copy group tasks" title="Copy tasks with comments">${Syntra.constants.COPY_ICON}</button>`;
}

async function ensureTaskComments(taskId) {
  if (Syntra.state.taskCommentsCache[taskId]) return Syntra.state.taskCommentsCache[taskId];
  const comments = await Syntra.core.request(`${Syntra.constants.API.tasks}/${taskId}/comments`);
  Syntra.state.taskCommentsCache[taskId] = comments;
  return comments;
}

function formatCommentsPlain(comments) {
  if (!comments?.length) return "—";
  return comments
    .map((entry) => {
      const member = entry.assignee_name || "—";
      const status = Syntra.core.formatTaskStatus(entry.status);
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
        `<span style="font-weight:600;color:#374151;">${Syntra.core.escapeHtml(entry.assignee_name || "—")}</span> · ` +
        `<span style="color:#6b7280;">${Syntra.core.escapeHtml(Syntra.core.formatTaskStatus(entry.status))}</span> · ` +
        `<span style="color:#6b7280;font-size:10pt;">${Syntra.core.escapeHtml(formatDateTime(entry.created_at))}</span><br/>` +
        `<span style="color:#374151;">${Syntra.core.escapeHtml(entry.comment)}</span></div>`
    )
    .join("");
}

function renderStandupStatusOptions(selected = "in_progress") {
  return Syntra.constants.STANDUP_STATUSES.map(
    (status) =>
      `<option value="${status}"${status === selected ? " selected" : ""}>${Syntra.core.escapeHtml(Syntra.core.formatTaskStatus(status))}</option>`
  ).join("");
}

function renderStandupMemberOptions(selectedId) {
  const options = ['<option value="">Select member</option>'];
  for (const member of Syntra.state.teamCache) {
    const selected = String(member.id) === String(selectedId ?? "") ? " selected" : "";
    options.push(`<option value="${member.id}"${selected}>${Syntra.core.escapeHtml(member.name)}</option>`);
  }
  return options.join("");
}

function getDefaultStandupMemberId(task) {
  if (Syntra.state.profileCache?.team_member_id) return Syntra.state.profileCache.team_member_id;
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
    Syntra.core.formatTaskStatus(task.status),
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
        <td style="${cellStyle}">${Syntra.core.escapeHtml(task.title || "—")}</td>
        <td style="${cellStyle}">${Syntra.core.escapeHtml(Syntra.core.formatTaskStatus(task.status))}</td>
        <td style="${cellStyle}">${Syntra.core.escapeHtml(task.priority || "—")}</td>
        <td style="${cellStyle}">${Syntra.core.escapeHtml(task.assignee_name || "—")}</td>
        <td style="${cellStyle}">${formatCommentsHtml(commentsByTaskId[task.id])}</td>
      </tr>`;
    })
    .join("");

  const fragment = `
    <div style="font-family:Calibri,Arial,sans-serif;color:#111827;">
      <p style="margin:0 0 4px 0;font-size:14pt;font-weight:700;">${Syntra.core.escapeHtml(groupName)}</p>
      <p style="margin:0 0 12px 0;font-size:10pt;color:#6b7280;">Exported from Syntra on ${Syntra.core.escapeHtml(exportedAt)}</p>
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

function isStandupUpdateToday(entry) {
  const date = parseStoredDateTime(entry.created_at);
  if (!date) return false;
  return localDateString(date) === localDateString();
}

async function prefetchTaskCommentsForSummary() {
  const taskIds = new Set([
    ...Syntra.state.taskCache.filter((task) => (task.comment_count || 0) > 0).map((task) => task.id),
    ...Object.keys(Syntra.state.taskCommentsCache).map((id) => parseInt(id, 10)),
  ]);
  await Promise.all([...taskIds].map((taskId) => ensureTaskComments(taskId)));
}

function collectTodayStandupUpdates() {
  const entries = [];

  for (const task of Syntra.state.taskCache) {
    const comments = Syntra.state.taskCommentsCache[task.id];
    if (!comments?.length) continue;

    for (const comment of comments) {
      if (!isStandupUpdateToday(comment)) continue;
      entries.push({
        taskId: task.id,
        taskTitle: task.title,
        groupName: task.group_name || "—",
        ...comment,
      });
    }
  }

  return entries.sort((a, b) => {
    const timeA = parseStoredDateTime(a.created_at)?.getTime() || 0;
    const timeB = parseStoredDateTime(b.created_at)?.getTime() || 0;
    return timeB - timeA;
  });
}

function renderStandupSummary(entries) {
  const container = document.getElementById("standup-summary-list");
  const countEl = document.getElementById("standup-summary-count");
  if (!container) return;

  if (countEl) {
    countEl.textContent = entries.length ? `(${entries.length})` : "";
  }

  if (!Syntra.state.taskCache.length) {
    container.innerHTML = '<p class="empty">No tasks yet.</p>';
    return;
  }

  if (!entries.length) {
    container.innerHTML = Syntra.core.renderEmptyState(
      "No standup updates posted today",
      "Open a task's standup panel and add an update below."
    );
    return;
  }

  container.innerHTML = `
    <div class="standup-table-wrap">
      <table class="standup-table standup-summary-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Group</th>
            <th>Member</th>
            <th>Status</th>
            <th>Update</th>
            <th class="standup-time-cell">Time</th>
          </tr>
        </thead>
        <tbody>
          ${entries
            .map(
              (entry) => `
            <tr>
              <td>${Syntra.core.escapeHtml(entry.taskTitle || "—")}</td>
              <td>${Syntra.core.escapeHtml(entry.groupName)}</td>
              <td>${Syntra.core.escapeHtml(entry.assignee_name || "—")}</td>
              <td>${Syntra.core.escapeHtml(Syntra.core.formatTaskStatus(entry.status))}</td>
              <td class="standup-update-cell">${Syntra.core.escapeHtml(entry.comment)}</td>
              <td class="standup-time-cell">${Syntra.core.escapeHtml(formatDateTime(entry.created_at))}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function buildStandupSummaryClipboardPlain(entries) {
  const exportedAt = nowFormatted();
  const todayLabel = new Date().toLocaleDateString(undefined, { dateStyle: "long" });
  const header = `Today's Standup — ${todayLabel}\nExported from Syntra on ${exportedAt}\n`;
  const columns = ["Task", "Group", "Member", "Status", "Update", "Time"];
  const rows = entries.map((entry) => [
    entry.taskTitle || "—",
    entry.groupName,
    entry.assignee_name || "—",
    Syntra.core.formatTaskStatus(entry.status),
    entry.comment,
    formatDateTime(entry.created_at),
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

function buildStandupSummaryClipboardHtml(entries) {
  const exportedAt = nowFormatted();
  const todayLabel = new Date().toLocaleDateString(undefined, { dateStyle: "long" });
  const headerCells = ["Task", "Group", "Member", "Status", "Update", "Time"]
    .map(
      (label) =>
        `<th style="border:1px solid #2f5597;background-color:#4472c4;color:#ffffff;padding:8px 10px;text-align:left;font-size:11pt;">${label}</th>`
    )
    .join("");

  const bodyRows = entries
    .map((entry, index) => {
      const rowBg = index % 2 === 0 ? "#ffffff" : "#f3f6fb";
      const cellStyle =
        "border:1px solid #bfbfbf;padding:8px 10px;vertical-align:top;font-size:11pt;color:#111827;";
      return `<tr style="background-color:${rowBg};">
        <td style="${cellStyle}">${Syntra.core.escapeHtml(entry.taskTitle || "—")}</td>
        <td style="${cellStyle}">${Syntra.core.escapeHtml(entry.groupName)}</td>
        <td style="${cellStyle}">${Syntra.core.escapeHtml(entry.assignee_name || "—")}</td>
        <td style="${cellStyle}">${Syntra.core.escapeHtml(Syntra.core.formatTaskStatus(entry.status))}</td>
        <td style="${cellStyle}">${Syntra.core.escapeHtml(entry.comment)}</td>
        <td style="${cellStyle}">${Syntra.core.escapeHtml(formatDateTime(entry.created_at))}</td>
      </tr>`;
    })
    .join("");

  const fragment = `
    <div style="font-family:Calibri,Arial,sans-serif;color:#111827;">
      <p style="margin:0 0 4px 0;font-size:14pt;font-weight:700;">Today's Standup — ${Syntra.core.escapeHtml(todayLabel)}</p>
      <p style="margin:0 0 12px 0;font-size:10pt;color:#6b7280;">Exported from Syntra on ${Syntra.core.escapeHtml(exportedAt)}</p>
      <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:960px;font-family:Calibri,Arial,sans-serif;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;

  return `<!DOCTYPE html><html><body><!--StartFragment-->${fragment}<!--EndFragment--></body></html>`;
}

async function refreshStandupSummary() {
  await prefetchTaskCommentsForSummary();
  const entries = collectTodayStandupUpdates();
  renderStandupSummary(entries);
  return entries;
}

async function copyAllStandupsToday() {
  const entries = collectTodayStandupUpdates();
  if (!entries.length) {
    Syntra.core.toast("No standup updates to copy for today");
    return;
  }

  const html = buildStandupSummaryClipboardHtml(entries);
  const plain = buildStandupSummaryClipboardPlain(entries);
  await copyHtmlToClipboard(html, plain);
  Syntra.core.toast("Today's standup copied to clipboard");
}

function initStandupSummary() {
  const copyBtn = document.getElementById("standup-summary-copy-btn");
  if (!copyBtn || copyBtn.dataset.bound === "true") return;
  copyBtn.dataset.bound = "true";

  copyBtn.addEventListener("click", () => {
    if (copyBtn.dataset.copying === "true") return;
    copyBtn.dataset.copying = "true";
    copyBtn.disabled = true;
    copyAllStandupsToday()
      .catch((err) => Syntra.core.toast(err.message, true))
      .finally(() => {
        copyBtn.dataset.copying = "false";
        copyBtn.disabled = false;
      });
  });
}

async function copyTaskGroup(groupId, groupName, source = "active") {
  const tasks =
    source === "archived"
      ? Syntra.state.archivedGroupCache.find((group) => group.id === groupId)?.tasks || []
      : Syntra.state.taskCache.filter((task) => task.group_id === groupId);

  if (!tasks.length) {
    Syntra.core.toast("No tasks to copy");
    return;
  }

  const commentsEntries = await Promise.all(
    tasks.map(async (task) => [task.id, await ensureTaskComments(task.id)])
  );
  const commentsByTaskId = Object.fromEntries(commentsEntries);
  const html = buildGroupTasksClipboardHtml(groupName, tasks, commentsByTaskId);
  const plain = buildGroupTasksClipboardPlain(groupName, tasks, commentsByTaskId);

  await copyHtmlToClipboard(html, plain);
  Syntra.core.toast(`"${groupName}" copied to clipboard`);
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
    .catch((err) => Syntra.core.toast(err.message, true))
    .finally(() => {
      button.dataset.copying = "false";
      button.disabled = false;
    });
}

function updateAssigneeOptions(members) {
  const assignOptions =
    '<option value="">Assign to team member</option>' +
    members.map((member) =>
      `<option value="${member.id}">${Syntra.core.escapeHtml(member.name)}</option>`
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
        `<option value="${member.id}">${Syntra.core.escapeHtml(member.name)}</option>`
      ).join("");
  }
}

function updateGroupOptions(groups) {
  Syntra.state.taskGroupCache = groups;
  const groupOptions = groups.map((group) =>
    `<option value="${group.id}">${Syntra.core.escapeHtml(group.name)}</option>`
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
  const groups = await Syntra.core.request(Syntra.constants.API.taskGroups);
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
  const { showArchive = false, expandedSet = Syntra.state.expandedTaskGroups, groupKeyPrefix = "" } = options;
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
              ? `<button type="button" class="task-group-archive-btn" data-group-id="${group.id}" data-group-name="${Syntra.core.escapeHtml(groupName)}" aria-label="Archive group" title="Archive group">Archive</button>`
              : ""
          }
        </div>`
      : "";

  return `
    <div class="task-group-block${isCollapsed ? " is-collapsed" : ""}" data-group-key="${groupKey}" data-group-prefix="${Syntra.core.escapeHtml(groupKeyPrefix)}">
      <div class="task-group-header-row">
        <button type="button" class="task-group-header" aria-expanded="${!isCollapsed}">
          <span class="task-group-chevron" aria-hidden="true"></span>
          <span class="task-group-name">${Syntra.core.escapeHtml(groupName)}</span>
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
      <td>${Syntra.core.escapeHtml(task.title)}</td>
      <td><span class="status status-${task.status}">${task.status.replace("_", " ")}</span></td>
      <td>${Syntra.core.escapeHtml(task.priority || "—")}</td>
      <td>${Syntra.core.escapeHtml(task.assignee_name || "—")}</td>
      <td>${Syntra.core.escapeHtml(formatDateTime(task.created_at))}</td>
      <td>${task.comment_count ? `${task.comment_count} comment${task.comment_count === 1 ? "" : "s"}` : "—"}</td>
    </tr>`;
}

function renderArchivedGroupBlock(group) {
  const groupName = group.name;
  const groupTasks = group.tasks || [];
  const taskCount = group.task_count ?? groupTasks.length;
  const storageKey = `archived:${groupName}`;
  const isCollapsed = !Syntra.state.expandedArchivedGroups.has(storageKey);
  const groupKey = encodeURIComponent(groupName);

  return `
    <div class="task-group-block archived-group-block${isCollapsed ? " is-collapsed" : ""}" data-group-key="${groupKey}" data-group-prefix="archived:">
      <div class="task-group-header-row">
        <button type="button" class="task-group-header" aria-expanded="${!isCollapsed}">
          <span class="task-group-chevron" aria-hidden="true"></span>
          <span class="task-group-name">${Syntra.core.escapeHtml(groupName)}</span>
          <span class="task-group-count">${groupTasks.length}</span>
        </button>
        <div class="archived-group-actions">
          <span class="archived-badge">Archived</span>
          ${renderTaskGroupCopyButton(group.id, groupName, "archived")}
          <button type="button" class="task-group-restore-btn" data-group-id="${group.id}" data-group-name="${Syntra.core.escapeHtml(groupName)}" data-task-count="${taskCount}" aria-label="Restore group" title="Restore group">Restore</button>
          <button type="button" class="task-group-delete-btn" data-group-id="${group.id}" data-group-name="${Syntra.core.escapeHtml(groupName)}" data-task-count="${taskCount}" aria-label="Delete group" title="Delete group">Delete</button>
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

function toggleTaskGroup(block, expandedSet = Syntra.state.expandedTaskGroups) {
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
  const taskCount = (Syntra.state.taskCache.filter((task) => task.group_id === groupId)).length;
  const confirmed = await Syntra.core.confirmDialog({
    title: `Archive "${groupName}"?`,
    message:
      taskCount > 0
        ? `This group and its ${taskCount} task${taskCount === 1 ? "" : "s"} will move to Archive and leave My Tasks.`
        : "This group will move to Archive and leave My Tasks.",
    confirmText: "Archive",
    variant: "warning",
  });
  if (!confirmed) return;

  await Syntra.core.request(`${Syntra.constants.API.taskGroups}/${groupId}/archive`, { method: "POST" });
  Syntra.core.toast(`"${groupName}" archived`);
  Syntra.state.expandedTaskGroups.delete(groupName);
  await loadDashboard();
  await loadArchivedGroups();
}

async function restoreArchivedGroup(groupId, groupName, taskCount) {
  const confirmed = await Syntra.core.confirmDialog({
    title: `Restore "${groupName}"?`,
    message:
      taskCount > 0
        ? `This group and its ${taskCount} task${taskCount === 1 ? "" : "s"} will return to My Tasks.`
        : "This group will return to My Tasks.",
    confirmText: "Restore",
    variant: "default",
  });
  if (!confirmed) return;

  await Syntra.core.request(`${Syntra.constants.API.taskGroups}/${groupId}/restore`, { method: "POST" });
  Syntra.core.toast(`"${groupName}" restored`);
  Syntra.state.expandedArchivedGroups.delete(`archived:${groupName}`);
  await loadDashboard();
  await loadArchivedGroups();
}

async function deleteArchivedGroup(groupId, groupName, taskCount) {
  const confirmed = await Syntra.core.confirmDialog({
    title: `Delete "${groupName}" permanently?`,
    message:
      taskCount > 0
        ? `This will permanently delete the group and all ${taskCount} task${taskCount === 1 ? "" : "s"}. This action cannot be undone.`
        : "This will permanently delete the group. This action cannot be undone.",
    confirmText: "Delete",
    variant: "danger",
  });
  if (!confirmed) return;

  await Syntra.core.request(`${Syntra.constants.API.taskGroups}/${groupId}`, { method: "DELETE" });
  Syntra.core.toast(`"${groupName}" deleted`);
  Syntra.state.expandedArchivedGroups.delete(`archived:${groupName}`);
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
      archiveTaskGroup(groupId, groupName).catch((err) => Syntra.core.toast(err.message, true));
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
      ).catch((err) => Syntra.core.toast(err.message, true));
      return;
    }

    const deleteBtn = event.target.closest(".task-group-delete-btn");
    if (deleteBtn) {
      event.stopPropagation();
      deleteArchivedGroup(
        parseInt(deleteBtn.dataset.groupId, 10),
        deleteBtn.dataset.groupName,
        parseInt(deleteBtn.dataset.taskCount, 10) || 0
      ).catch((err) => Syntra.core.toast(err.message, true));
      return;
    }

    const header = event.target.closest(".task-group-header");
    if (!header) return;
    const block = header.closest(".task-group-block");
    if (block) toggleTaskGroup(block, Syntra.state.expandedArchivedGroups);
  });
}

function renderTaskRow(task) {
  const commentsOpen = Syntra.state.expandedTaskComments.has(task.id);
  const bodyCollapsed = Syntra.state.standupBodyCollapsed.has(task.id);
  const commentCount = task.comment_count || 0;
  const isDone = task.status === "done";
  const query = Syntra.core.normalizeSearchQuery(Syntra.state.searchQuery);
  const isSearchMatch = query && Syntra.search.taskMatchesSearch(task, query);
  const defaultMemberId = getDefaultStandupMemberId(task);

  return `
    <tr class="editable-row${isDone ? " is-done" : ""}${isSearchMatch ? " search-match" : ""}" data-id="${task.id}" title="Double-click to edit">
      <td class="done-col">
        <button type="button" class="task-done-toggle${isDone ? " is-done" : ""}" data-id="${task.id}" aria-label="${isDone ? "Mark as pending" : "Mark as done"}" title="${isDone ? "Mark as pending" : "Mark as done"}">${isDone ? "✓" : ""}</button>
      </td>
      <td class="task-title-cell">${Syntra.core.escapeHtml(task.title)}</td>
      <td><span class="status status-${task.status}">${task.status.replace("_", " ")}</span></td>
      <td>${Syntra.core.escapeHtml(task.priority || "—")}</td>
      <td>${Syntra.core.escapeHtml(task.assignee_name || "—")}</td>
      <td>${Syntra.search.renderDueDateCell(task)}</td>
      <td class="actions-cell">
        <button type="button" class="task-comments-btn" data-id="${task.id}" aria-label="View standup updates" title="Standup updates">
          <span class="task-comments-icon" aria-hidden="true">💬</span>
          <span class="task-comments-count" id="task-comment-count-${task.id}">${commentCount}</span>
        </button>
        ${Syntra.ui.renderDeleteButton(task.id, "task")}
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
    const comments = await Syntra.core.request(`${Syntra.constants.API.tasks}/${taskId}/comments`);
    Syntra.state.taskCommentsCache[taskId] = comments;
    renderTaskCommentsList(taskId, comments);
    updateTaskCommentCount(taskId, comments.length);
  } catch (err) {
    listEl.innerHTML = `<p class="empty">${Syntra.core.escapeHtml(err.message)}</p>`;
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
            <td>${Syntra.core.escapeHtml(entry.assignee_name || "—")}</td>
            <td><span class="status status-${entry.status || "in_progress"}">${Syntra.core.escapeHtml(Syntra.core.formatTaskStatus(entry.status))}</span></td>
            <td class="standup-update-cell">${Syntra.core.escapeHtml(entry.comment)}</td>
            <td class="standup-time-cell">${Syntra.core.escapeHtml(formatDateTime(entry.created_at))}</td>
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
    Syntra.state.standupBodyCollapsed.add(taskId);
  } else {
    Syntra.state.standupBodyCollapsed.delete(taskId);
  }

  if (toggle) toggle.setAttribute("aria-expanded", String(!willCollapse));
  if (chevron) chevron.classList.toggle("is-collapsed", willCollapse);
}

function updateTaskCommentCount(taskId, count) {
  const badge = document.getElementById(`task-comment-count-${taskId}`);
  if (badge) badge.textContent = count;
  const task = Syntra.state.taskCache.find((item) => item.id === taskId);
  if (task) task.comment_count = count;
}

async function toggleTaskComments(taskId) {
  const row = document.getElementById(`task-comments-${taskId}`);
  if (!row) return;

  const isOpen = !row.hidden;
  if (isOpen) {
    row.hidden = true;
    Syntra.state.expandedTaskComments.delete(taskId);
    return;
  }

  row.hidden = false;
  Syntra.state.expandedTaskComments.add(taskId);
  Syntra.state.standupBodyCollapsed.delete(taskId);
  const body = document.getElementById(`standup-panel-body-${taskId}`);
  const toggle = document.querySelector(`.standup-panel-toggle[data-task-id="${taskId}"]`);
  const chevron = toggle?.querySelector(".standup-panel-chevron");
  if (body) body.hidden = false;
  if (toggle) toggle.setAttribute("aria-expanded", "true");
  if (chevron) chevron.classList.remove("is-collapsed");
  await loadTaskComments(taskId);
}

async function addTaskComment(taskId, payload) {
  const entry = await Syntra.core.request(`${Syntra.constants.API.tasks}/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({
      comment: payload.comment,
      status: payload.status || "in_progress",
      assigned_to: payload.assigned_to,
      author_name: Syntra.state.profileCache?.display_name || "User",
    }),
  });
  Syntra.state.taskCommentsCache[taskId] = [...(Syntra.state.taskCommentsCache[taskId] || []), entry];
  renderTaskCommentsList(taskId, Syntra.state.taskCommentsCache[taskId]);
  updateTaskCommentCount(taskId, Syntra.state.taskCommentsCache[taskId].length);
  refreshStandupSummary().catch((err) => Syntra.core.toast(err.message, true));
  Syntra.core.toast("Standup update posted");
  return entry;
}

async function deleteTaskComment(taskId, commentId) {
  const confirmed = await Syntra.core.confirmDialog({
    title: "Delete update?",
    message: "This standup update will be permanently removed.",
    confirmText: "Delete",
    variant: "danger",
  });
  if (!confirmed) return;

  await Syntra.core.request(`${Syntra.constants.API.tasks}/${taskId}/comments/${commentId}`, { method: "DELETE" });
  Syntra.state.taskCommentsCache[taskId] = (Syntra.state.taskCommentsCache[taskId] || []).filter((item) => item.id !== commentId);
  renderTaskCommentsList(taskId, Syntra.state.taskCommentsCache[taskId]);
  updateTaskCommentCount(taskId, Syntra.state.taskCommentsCache[taskId].length);
  refreshStandupSummary().catch((err) => Syntra.core.toast(err.message, true));
  Syntra.ui.closeCreatePanel("standup-edit-panel");
  Syntra.core.toast("Standup update deleted");
}

async function updateStandupComment(taskId, commentId, payload) {
  const entry = await Syntra.core.request(`${Syntra.constants.API.tasks}/${taskId}/comments/${commentId}`, {
    method: "PUT",
    body: JSON.stringify({
      comment: payload.comment,
      status: payload.status || "in_progress",
      assigned_to: payload.assigned_to,
    }),
  });
  Syntra.state.taskCommentsCache[taskId] = (Syntra.state.taskCommentsCache[taskId] || []).map((item) =>
    item.id === commentId ? entry : item
  );
  renderTaskCommentsList(taskId, Syntra.state.taskCommentsCache[taskId]);
  refreshStandupSummary().catch((err) => Syntra.core.toast(err.message, true));
  Syntra.ui.closeCreatePanel("standup-edit-panel");
  Syntra.core.toast("Standup update saved");
  return entry;
}
function openTaskEdit(task) {
  Syntra.ui.closeCreatePanel("task-create-panel");
  Syntra.ui.closeCreatePanel("standup-edit-panel");
  document.getElementById("task-edit-id").value = task.id;
  document.getElementById("task-edit-title").value = task.title || "";
  document.getElementById("task-edit-group").value = task.group_id || "";
  document.getElementById("task-edit-assignee").value = task.assigned_to || "";
  document.getElementById("task-edit-status").value = task.status || "pending";
  document.getElementById("task-edit-priority").value = task.priority || "medium";
  document.getElementById("task-edit-due").value = formatDateInput(task.due_date);
  Syntra.ui.highlightRow(task.id);
  Syntra.ui.openEditPanel("task-edit-panel", "task-edit-title");
}

function openStandupEdit(taskId, comment) {
  Syntra.ui.closeCreatePanel("task-create-panel");
  Syntra.ui.closeCreatePanel("task-edit-panel");
  document.getElementById("standup-edit-task-id").value = taskId;
  document.getElementById("standup-edit-id").value = comment.id;
  document.getElementById("standup-edit-member").value = comment.assigned_to || "";
  document.getElementById("standup-edit-status").value = comment.status || "in_progress";
  document.getElementById("standup-edit-comment").value = comment.comment || "";
  Syntra.ui.highlightStandupRow(taskId, comment.id);
  Syntra.ui.openEditPanel("standup-edit-panel", "standup-edit-comment");
}

function openNoteEdit(note) {
  Syntra.ui.closeCreatePanel("note-create-panel");
  document.getElementById("note-edit-id").value = note.id;
  document.getElementById("note-edit-title").value = note.title || "";
  document.getElementById("note-edit-content").value = note.content || "";
  Syntra.ui.highlightRow(note.id);
  Syntra.ui.openEditPanel("note-edit-panel", "note-edit-title");
}

function openTeamEdit(member) {
  Syntra.ui.closeCreatePanel("team-create-panel");
  document.getElementById("team-edit-id").value = member.id;
  document.getElementById("team-edit-name").value = member.name || "";
  document.getElementById("team-edit-role").value = member.role || "";
  document.getElementById("team-edit-email").value = member.email || "";
  document.getElementById("team-edit-status").value = member.status || "offline";
  Syntra.ui.highlightRow(member.id);
  Syntra.ui.openEditPanel("team-edit-panel", "team-edit-name");
}

function openReminderEdit(reminder) {
  document.getElementById("reminder-edit-id").value = reminder.id;
  document.getElementById("reminder-edit-title").value = reminder.title || "";
  document.getElementById("reminder-edit-datetime").value = toLocalDateTimeValue(reminder.remind_at);
  document.getElementById("reminder-edit-assignee").value = reminder.assigned_to || "";
  document.getElementById("reminder-edit-status").value = reminder.status || "pending";
  Syntra.ui.highlightRow(reminder.id);
  Syntra.ui.openEditPanel("reminder-edit-panel", "reminder-edit-title");
}

async function markTaskDone(taskId, done) {
  if (done) {
    await Syntra.core.request(`${Syntra.constants.API.tasks}/${taskId}/done`, { method: "POST" });
    Syntra.core.toast("Task marked done");
  } else {
    await Syntra.core.request(`${Syntra.constants.API.tasks}/${taskId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "pending" }),
    });
    Syntra.core.toast("Task marked pending");
  }
  const tasks = await loadTasks();
  Syntra.ui.updateDashboardStats(tasks, Syntra.state.teamCache);
}

async function updateTask(taskId, payload) {
  const task = await Syntra.core.request(`${Syntra.constants.API.tasks}/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  Syntra.core.toast("Task updated");
  Syntra.ui.closeCreatePanel("task-edit-panel");
  const tasks = await loadTasks();
  const members = await Syntra.core.request(Syntra.constants.API.team);
  Syntra.ui.updateDashboardStats(tasks, members);
  return task;
}

async function deleteTask(taskId) {
  Syntra.state.expandedTaskComments.delete(taskId);
  delete Syntra.state.taskCommentsCache[taskId];
  await Syntra.ui.deleteResource(`${Syntra.constants.API.tasks}/${taskId}`, "task", "task-edit-panel", async () => {
    const tasks = await loadTasks();
    const members = await Syntra.core.request(Syntra.constants.API.team);
    Syntra.ui.updateDashboardStats(tasks, members);
  });
}

async function updateNote(noteId, payload) {
  const note = await Syntra.core.request(`${Syntra.constants.API.notes}/${noteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  Syntra.core.toast("Note updated");
  Syntra.ui.closeCreatePanel("note-edit-panel");
  await loadNotes();
  return note;
}

async function deleteNote(noteId) {
  await Syntra.ui.deleteResource(`${Syntra.constants.API.notes}/${noteId}`, "note", "note-edit-panel", loadNotes);
}

async function updateTeamMember(memberId, payload) {
  const member = await Syntra.core.request(`${Syntra.constants.API.team}/${memberId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  Syntra.core.toast("Team member updated");
  Syntra.ui.closeCreatePanel("team-edit-panel");
  await loadDashboard();
  return member;
}

async function deleteTeamMember(memberId) {
  await Syntra.ui.deleteResource(`${Syntra.constants.API.team}/${memberId}`, "team member", "team-edit-panel", loadDashboard);
}

async function updateReminder(reminderId, payload, options = {}) {
  const { silent = false } = options;
  const reminder = await Syntra.core.request(`${Syntra.constants.API.reminders}/${reminderId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!silent) {
    Syntra.core.toast("Reminder updated");
    Syntra.ui.closeCreatePanel("reminder-edit-panel");
  }
  await loadReminders();
  return reminder;
}

async function deleteReminder(reminderId) {
  await Syntra.ui.deleteResource(`${Syntra.constants.API.reminders}/${reminderId}`, "reminder", "reminder-edit-panel", loadReminders);
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
      const task = Syntra.state.taskCache.find((entry) => entry.id === taskId);
      const willMarkDone = task?.status !== "done";
      markTaskDone(taskId, willMarkDone).catch((err) => Syntra.core.toast(err.message, true));
      return;
    }

    const deleteBtn = event.target.closest(".row-delete-btn");
    if (deleteBtn) {
      event.stopPropagation();
      deleteTask(parseInt(deleteBtn.dataset.id, 10)).catch((err) => Syntra.core.toast(err.message, true));
      return;
    }

    const commentsBtn = event.target.closest(".task-comments-btn");
    if (commentsBtn) {
      event.stopPropagation();
      toggleTaskComments(parseInt(commentsBtn.dataset.id, 10)).catch((err) => Syntra.core.toast(err.message, true));
      return;
    }

    const deleteCommentBtn = event.target.closest(".task-comment-delete");
    if (deleteCommentBtn) {
      event.stopPropagation();
      deleteTaskComment(
        parseInt(deleteCommentBtn.dataset.taskId, 10),
        parseInt(deleteCommentBtn.dataset.id, 10)
      ).catch((err) => Syntra.core.toast(err.message, true));
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
      const comment = (Syntra.state.taskCommentsCache[taskId] || []).find((entry) => entry.id === commentId);
      if (comment) openStandupEdit(taskId, comment);
      return;
    }

    const row = event.target.closest(".editable-row");
    if (!row) return;
    const task = Syntra.state.taskCache.find((entry) => String(entry.id) === row.dataset.id);
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
      Syntra.core.toast("Select a team member", true);
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
      .catch((err) => Syntra.core.toast(err.message, true));
  });
}

function bindNoteListEvents() {
  Syntra.ui.bindEditableList("notes-list", () => Syntra.state.noteCache, openNoteEdit, deleteNote);
}

function bindTeamListEvents() {
  Syntra.ui.bindEditableList("team-list", () => Syntra.state.teamCache, openTeamEdit, deleteTeamMember);
}

function bindReminderListEvents() {
  Syntra.ui.bindEditableList("reminders-list", () => Syntra.state.reminderCache, openReminderEdit, deleteReminder);
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
      toggleBtn.addEventListener("click", () => Syntra.ui.toggleCreatePanel(panel, toggleBtn));
    }
  });

  document.querySelectorAll(".inline-cancel").forEach((btn) => {
    btn.addEventListener("click", () => Syntra.ui.closeCreatePanel(btn.dataset.panel));
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
        Syntra.ui.closeCreatePanel("task-create-panel");
      } catch (err) {
        Syntra.core.toast(err.message, true);
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
        Syntra.core.toast(err.message, true);
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
        Syntra.core.toast("Select a team member", true);
        return;
      }
      try {
        await updateStandupComment(taskId, commentId, {
          comment,
          status: document.getElementById("standup-edit-status").value,
          assigned_to: parseInt(assignedTo, 10),
        });
      } catch (err) {
        Syntra.core.toast(err.message, true);
      }
    });
  }

  bindTaskListEvents();
  bindTaskGroupEvents();
  bindArchiveGroupEvents();
  Syntra.search.initTaskFilters();
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
        Syntra.core.toast(err.message, true);
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
        Syntra.core.toast(err.message, true);
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
        Syntra.core.toast(err.message, true);
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
        Syntra.ui.closeCreatePanel("note-create-panel");
      } catch (err) {
        Syntra.core.toast(err.message, true);
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
        Syntra.ui.closeCreatePanel("team-create-panel");
      } catch (err) {
        Syntra.core.toast(err.message, true);
      }
    });
  }
}

async function loadTasks() {
  Syntra.state.taskCache = await Syntra.core.request(Syntra.constants.API.tasks);
  renderTasksFromCache();
  return Syntra.state.taskCache;
}

function renderTasksFromCache() {
  const container = document.getElementById("tasks-list");
  if (!container) return;

  const tasks = Syntra.search.getFilteredTasks();
  const hasFilters =
    Syntra.state.taskFilters.status || Syntra.state.taskFilters.priority || Syntra.state.taskFilters.assignee || Syntra.core.normalizeSearchQuery(Syntra.state.searchQuery);

  if (!Syntra.state.taskCache.length) {
    container.innerHTML = Syntra.core.renderEmptyState(
      "No tasks yet",
      "Click + to add one. Double-click a task to edit it, or use My Work after linking your profile."
    );
    return;
  }

  if (!tasks.length) {
    container.innerHTML = hasFilters
      ? Syntra.core.renderEmptyState("No tasks match your filters or search.", "Try clearing filters or the search box.")
      : Syntra.core.renderEmptyState(
          "No tasks yet",
          "Click + to add one. Double-click a task to edit it, or use My Work after linking your profile."
        );
    return;
  }

  container.innerHTML = groupTasksByGroup(tasks)
    .map((group) => renderTaskGroupBlock(group, { showArchive: Boolean(group.id) }))
    .join("");

  Syntra.state.expandedTaskComments.forEach((taskId) => {
    if (document.getElementById(`task-comments-${taskId}`)) {
      loadTaskComments(taskId).catch((err) => Syntra.core.toast(err.message, true));
    }
  });
}

async function loadNotes() {
  Syntra.state.noteCache = await Syntra.core.request(Syntra.constants.API.notes);
  renderNotesFromCache();
  return Syntra.state.noteCache;
}

function renderNotesFromCache() {
  const container = document.getElementById("notes-list");
  if (!container) return;

  const notes = Syntra.search.getFilteredNotes();
  const query = Syntra.core.normalizeSearchQuery(Syntra.state.searchQuery);

  if (!Syntra.state.noteCache.length) {
    container.innerHTML = Syntra.core.renderEmptyState("No notes yet", "Click + to add one. Double-click a note to edit it.");
    return;
  }

  if (!notes.length) {
    container.innerHTML = Syntra.core.renderEmptyState("No notes match your search.", "Try a different search term.");
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr><th>Title</th><th>Content</th><th>Updated</th><th></th></tr>
      </thead>
      <tbody>
        ${notes.map((note) => `
          <tr class="editable-row${query && Syntra.search.noteMatchesSearch(note, query) ? " search-match" : ""}" data-id="${note.id}" title="Double-click to edit">
            <td>${Syntra.core.escapeHtml(note.title)}</td>
            <td>${Syntra.core.escapeHtml(Syntra.core.truncate(note.content, 80))}</td>
            <td>${Syntra.core.escapeHtml(formatDateTime(note.updated_at || note.created_at))}</td>
            <td class="actions-cell">${Syntra.ui.renderDeleteButton(note.id, "note")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

async function loadTeam() {
  Syntra.state.teamCache = await Syntra.core.request(Syntra.constants.API.team);
  updateAssigneeOptions(Syntra.state.teamCache);
  Syntra.search.updateTaskFilterAssigneeOptions();
  renderTeamFromCache();
  return Syntra.state.teamCache;
}

function renderTeamFromCache() {
  const container = document.getElementById("team-list");
  if (!container) return;

  const members = Syntra.search.getFilteredTeam();
  const query = Syntra.core.normalizeSearchQuery(Syntra.state.searchQuery);

  if (!Syntra.state.teamCache.length) {
    container.innerHTML = Syntra.core.renderEmptyState(
      "No team members yet",
      "Click + to add one, then link yourself in Profile for My Work and standup defaults."
    );
    return;
  }

  if (!members.length) {
    container.innerHTML = Syntra.core.renderEmptyState("No team members match your search.", "Try a different search term.");
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${members.map((member) => `
          <tr class="editable-row${query && Syntra.search.memberMatchesSearch(member, query) ? " search-match" : ""}" data-id="${member.id}" title="Double-click to edit">
            <td>${Syntra.core.escapeHtml(member.name)}</td>
            <td>${Syntra.core.escapeHtml(member.role || "—")}</td>
            <td>${Syntra.core.escapeHtml(member.email || "—")}</td>
            <td>${Syntra.core.escapeHtml(member.status || "—")}</td>
            <td class="actions-cell">${Syntra.ui.renderDeleteButton(member.id, "team member")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

async function loadReminders() {
  const reminders = await Syntra.core.request(Syntra.constants.API.reminders);
  Syntra.state.reminderCache = reminders;
  const container = document.getElementById("reminders-list");
  if (!container) {
    await Syntra.reminders.refreshReminderAlerts();
    return reminders;
  }

  if (!reminders.length) {
    container.innerHTML = Syntra.core.renderEmptyState(
      "No reminders yet",
      "Add one above, then enable notifications in Settings for popup alerts."
    );
    await Syntra.reminders.refreshReminderAlerts();
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
            <td>${Syntra.core.escapeHtml(reminder.title)}</td>
            <td>${Syntra.core.escapeHtml(formatDateTime(reminder.remind_at))}</td>
            <td>${Syntra.core.escapeHtml(reminder.assignee_name || "—")}</td>
            <td><span class="status status-${reminder.status}">${reminder.status}</span></td>
            <td class="actions-cell">${Syntra.ui.renderDeleteButton(reminder.id, "reminder")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
  await Syntra.reminders.refreshReminderAlerts();
  return reminders;
}

async function loadArchivedGroups() {
  const groups = await Syntra.core.request(Syntra.constants.API.archivedTaskGroups);
  Syntra.state.archivedGroupCache = groups;
  const container = document.getElementById("archive-list");
  if (!container) return groups;

  if (!groups.length) {
    container.innerHTML = Syntra.core.renderEmptyState(
      "No archived groups yet",
      "Archive a group from My Tasks to see it here."
    );
    return groups;
  }

  container.innerHTML = groups
    .map((group) => renderArchivedGroupBlock(group))
    .join("");

  return groups;
}

async function loadDashboard() {
  await Syntra.settings.loadSettings();
  const [tasks, , members] = await Promise.all([
    loadTasks(),
    loadNotes(),
    loadTeam(),
    loadReminders(),
    loadTaskGroups(),
    loadArchivedGroups(),
    Syntra.profile.loadProfile(),
  ]);
  Syntra.ui.updateDashboardStats(tasks, members);
  await refreshStandupSummary();
  Syntra.search.updateMyWorkFilterButton();
  return { tasks, members };
}

async function addTask(payload) {
  const task = await Syntra.core.request(Syntra.constants.API.tasks, {
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
  Syntra.core.toast("Task created");
  await loadDashboard();
  return task;
}

async function addNote(payload) {
  const note = await Syntra.core.request(Syntra.constants.API.notes, {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      content: payload.content || null,
    }),
  });
  Syntra.core.toast("Note created");
  await loadNotes();
  return note;
}

async function addTeamMember(payload) {
  const member = await Syntra.core.request(Syntra.constants.API.team, {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      role: payload.role || null,
      email: payload.email || null,
    }),
  });
  Syntra.core.toast("Team member added");
  await loadDashboard();
  return member;
}

async function addReminder(payload) {
  const reminder = await Syntra.core.request(Syntra.constants.API.reminders, {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      remind_at: payload.remind_at,
      assigned_to: payload.assigned_to || null,
    }),
  });
  Syntra.core.toast("Reminder created");
  await loadReminders();
  return reminder;
}

  Syntra.tasks = { renderTaskGroupCopyButton, ensureTaskComments, formatCommentsPlain, formatCommentsHtml, renderStandupStatusOptions, renderStandupMemberOptions, getDefaultStandupMemberId, updateStandupPanelHeader, buildGroupTasksClipboardPlain, buildGroupTasksClipboardHtml, copyHtmlToClipboard, isStandupUpdateToday, prefetchTaskCommentsForSummary, collectTodayStandupUpdates, renderStandupSummary, buildStandupSummaryClipboardPlain, buildStandupSummaryClipboardHtml, refreshStandupSummary, copyAllStandupsToday, initStandupSummary, copyTaskGroup, handleTaskGroupCopyClick, updateAssigneeOptions, updateGroupOptions, syncTaskGroupNewField, loadTaskGroups, resolveCreateGroupPayload, groupTasksByGroup, renderTaskGroupBlock, renderArchivedTaskRow, renderArchivedGroupBlock, toggleTaskGroup, archiveTaskGroup, restoreArchivedGroup, deleteArchivedGroup, bindTaskGroupEvents, bindArchiveGroupEvents, renderTaskRow, loadTaskComments, renderTaskCommentsList, toggleStandupBody, updateTaskCommentCount, toggleTaskComments, addTaskComment, deleteTaskComment, updateStandupComment, openTaskEdit, openStandupEdit, openNoteEdit, openTeamEdit, openReminderEdit, markTaskDone, updateTask, deleteTask, updateNote, deleteNote, updateTeamMember, deleteTeamMember, updateReminder, deleteReminder, bindTaskListEvents, bindNoteListEvents, bindTeamListEvents, bindReminderListEvents, initCreatePanels, loadTasks, renderTasksFromCache, loadNotes, renderNotesFromCache, loadTeam, renderTeamFromCache, loadReminders, loadArchivedGroups, loadDashboard, addTask, addNote, addTeamMember, addReminder };

})(window);
