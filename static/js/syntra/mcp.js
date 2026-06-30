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

  const refreshTasks = Syntra.constants.TASK_TOOLS.has(toolKey);
  const refreshNotes = Syntra.constants.NOTE_TOOLS.has(toolKey);

  if (refreshTasks && refreshNotes) {
    await Syntra.tasks.loadDashboard();
    return;
  }

  if (refreshTasks) {
    const tasks = await Syntra.tasks.loadTasks();
    const members = await Syntra.core.request(Syntra.constants.API.team);
    Syntra.ui.updateDashboardStats(tasks, members);
  }

  if (refreshNotes) {
    await Syntra.tasks.loadNotes();
  }
}

async function executeMCPCommand(command) {
  const text = (command || "").trim();
  if (!text) {
    Syntra.core.toast("Enter a command first", true);
    return null;
  }

  try {
    const res = await fetch(`${Syntra.constants.API.mcp}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: text }),
    });
    const data = await res.json();
    displayMcpResult(data, text);

    if (data.success) {
      await refreshAfterMcp(data);
      Syntra.core.toast(data.message || "Command executed");
    } else {
      Syntra.core.toast(data.message || "Command failed", true);
    }

    return data;
  } catch (err) {
    displayMcpResult({
      success: false,
      message: err.message,
      match: { no_match: true, confidence: 0, reason: err.message },
    }, text);
    Syntra.core.toast(err.message, true);
    return null;
  }
}

  Syntra.mcp = { formatScore, setScoreBar, displayMcpResult, refreshAfterMcp, executeMCPCommand };

})(window);
