(function () {
  "use strict";

  let refsCache = { from: { branches: [], tags: [] }, to: { branches: [], tags: [] } };
  let currentComparison = null;

  const els = {
    sessionLabel: document.getElementById("session-label"),
    logoutBtn: document.getElementById("logout-btn"),
    fromRepo: document.getElementById("from-repo"),
    toRepo: document.getElementById("to-repo"),
    loadRefsBtn: document.getElementById("load-refs-btn"),
    refsError: document.getElementById("refs-error"),
    refSelectors: document.getElementById("ref-selectors"),
    fromRef: document.getElementById("from-ref"),
    toRef: document.getElementById("to-ref"),
    compareBtn: document.getElementById("compare-btn"),
    compareError: document.getElementById("compare-error"),
    historyList: document.getElementById("history-list"),
    refreshHistoryBtn: document.getElementById("refresh-history-btn"),
    resultsPanel: document.getElementById("results-panel"),
    compareStats: document.getElementById("compare-stats"),
    fileList: document.getElementById("file-list"),
    diffViewer: document.getElementById("diff-viewer"),
    diffFileTitle: document.getElementById("diff-file-title"),
    diffLeft: document.getElementById("diff-left"),
    diffRight: document.getElementById("diff-right"),
    diffUnified: document.getElementById("diff-unified"),
    closeDiffBtn: document.getElementById("close-diff-btn"),
    downloadHtmlBtn: document.getElementById("download-html-btn"),
    openViewLink: document.getElementById("open-view-link"),
  };

  async function api(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  }

  function selectedRefType(name) {
    const input = document.querySelector(`input[name="${name}"]:checked`);
    return input ? input.value : "branch";
  }

  function populateSelect(select, refType, refs) {
    const list = refType === "tag" ? refs.tags : refs.branches;
    select.innerHTML = list.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderStats(stats) {
    const items = [
      ["Added", stats.added || 0],
      ["Removed", stats.removed || 0],
      ["Modified", stats.modified || 0],
      ["Unchanged", stats.unchanged || 0],
    ];
    if (stats.skipped) items.push(["Skipped", stats.skipped]);
    if (stats.truncated) items.push(["Truncated", "yes"]);
    els.compareStats.innerHTML = items
      .map(([label, value]) => `<span class="gc-stat">${label}: ${value}</span>`)
      .join("");
  }

  function renderFiles(files) {
    if (!files.length) {
      els.fileList.innerHTML = '<p class="gc-muted">No file differences found.</p>';
      return;
    }
    els.fileList.innerHTML = files
      .map((file, index) => {
        const badgeClass = file.skipped ? "skipped" : file.status;
        return `
          <button type="button" class="gc-file-item" data-index="${index}" ${file.skipped ? "disabled" : ""}>
            <span>${escapeHtml(file.path)}</span>
            <span class="gc-badge gc-badge-${badgeClass}">${escapeHtml(file.status)}</span>
          </button>`;
      })
      .join("");

    els.fileList.querySelectorAll(".gc-file-item:not([disabled])").forEach((button) => {
      button.addEventListener("click", () => {
        const file = files[Number(button.dataset.index)];
        showDiff(file);
      });
    });
  }

  function showDiff(file) {
    els.diffFileTitle.textContent = file.path;
    els.diffLeft.textContent = file.left || "";
    els.diffRight.textContent = file.right || "";
    els.diffUnified.textContent = file.unified_diff || "";
    els.diffViewer.hidden = false;
  }

  async function loadSession() {
    const data = await api("/git-compare/api/session");
    els.sessionLabel.textContent = `Signed in as ${data.user.user_id} (${data.user.provider})`;
  }

  async function loadHistory() {
    const history = await api("/git-compare/api/history");
    if (!history.length) {
      els.historyList.innerHTML = '<p class="gc-muted">No comparisons yet.</p>';
      return;
    }
    els.historyList.innerHTML = history
      .map((item) => {
        const stats = item.stats || {};
        return `
          <div class="gc-history-item">
            <strong>${escapeHtml(item.from_repo)} (${escapeHtml(item.from_ref)}) → ${escapeHtml(item.to_repo)} (${escapeHtml(item.to_ref)})</strong>
            <span class="gc-muted">${escapeHtml(item.created_at || "")} · +${stats.added || 0} / -${stats.removed || 0} / ~${stats.modified || 0}</span>
            <div class="gc-history-actions">
              <a class="gc-btn gc-btn-ghost" href="/git-compare/view/${item.id}">View</a>
              <a class="gc-btn gc-btn-secondary" href="/git-compare/api/history/${item.id}/download">Download HTML</a>
            </div>
          </div>`;
      })
      .join("");
  }

  async function loadRefs() {
    els.refsError.hidden = true;
    els.loadRefsBtn.disabled = true;
    try {
      const fromRepo = els.fromRepo.value.trim();
      const toRepo = els.toRepo.value.trim();
      const [fromData, toData] = await Promise.all([
        api(`/git-compare/api/refs?repo=${encodeURIComponent(fromRepo)}`),
        api(`/git-compare/api/refs?repo=${encodeURIComponent(toRepo)}`),
      ]);
      refsCache.from = fromData;
      refsCache.to = toData;
      populateSelect(els.fromRef, selectedRefType("from-ref-type"), fromData);
      populateSelect(els.toRef, selectedRefType("to-ref-type"), toData);
      els.refSelectors.hidden = false;
      els.compareBtn.disabled = false;
    } catch (err) {
      els.refsError.textContent = err.message;
      els.refsError.hidden = false;
    } finally {
      els.loadRefsBtn.disabled = false;
    }
  }

  async function runCompare() {
    els.compareError.hidden = true;
    els.compareBtn.disabled = true;
    try {
      currentComparison = await api("/git-compare/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_repo: els.fromRepo.value.trim(),
          to_repo: els.toRepo.value.trim(),
          from_ref: els.fromRef.value,
          from_ref_type: selectedRefType("from-ref-type"),
          to_ref: els.toRef.value,
          to_ref_type: selectedRefType("to-ref-type"),
        }),
      });
      els.resultsPanel.hidden = false;
      renderStats(currentComparison.stats || {});
      renderFiles(currentComparison.files || []);
      els.diffViewer.hidden = true;

      if (currentComparison.history_id) {
        els.downloadHtmlBtn.disabled = false;
        els.openViewLink.href = `/git-compare/view/${currentComparison.history_id}`;
        els.openViewLink.hidden = false;
        els.downloadHtmlBtn.onclick = () => {
          window.location.href = `/git-compare/api/history/${currentComparison.history_id}/download`;
        };
      }
      await loadHistory();
    } catch (err) {
      els.compareError.textContent = err.message;
      els.compareError.hidden = false;
    } finally {
      els.compareBtn.disabled = false;
    }
  }

  document.querySelectorAll('input[name="from-ref-type"]').forEach((input) => {
    input.addEventListener("change", () => populateSelect(els.fromRef, input.value, refsCache.from));
  });
  document.querySelectorAll('input[name="to-ref-type"]').forEach((input) => {
    input.addEventListener("change", () => populateSelect(els.toRef, input.value, refsCache.to));
  });

  els.logoutBtn.addEventListener("click", async () => {
    els.logoutBtn.disabled = true;
    try {
      await fetch("/git-compare/api/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });
    } catch (_err) {
      /* still leave the app */
    }
    window.location.replace("/git-compare/login");
  });
  els.loadRefsBtn.addEventListener("click", loadRefs);
  els.compareBtn.addEventListener("click", runCompare);
  els.refreshHistoryBtn.addEventListener("click", () => loadHistory().catch(showFatal));
  els.closeDiffBtn.addEventListener("click", () => {
    els.diffViewer.hidden = true;
  });

  function showFatal(err) {
    els.compareError.textContent = err.message;
    els.compareError.hidden = false;
  }

  Promise.all([loadSession(), loadHistory()]).catch(() => {
    window.location.href = "/git-compare/login";
  });
})();
