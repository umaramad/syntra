(function () {
  "use strict";

  const entryId = window.GIT_COMPARE_ENTRY_ID;
  const meta = document.getElementById("view-meta");
  const statsEl = document.getElementById("view-stats");
  const fileList = document.getElementById("view-file-list");
  const diffPanel = document.getElementById("view-diff");
  const diffTitle = document.getElementById("view-diff-title");
  const diffLeft = document.getElementById("view-diff-left");
  const diffRight = document.getElementById("view-diff-right");
  const diffUnified = document.getElementById("view-diff-unified");
  const closeDiff = document.getElementById("view-close-diff");
  const downloadBtn = document.getElementById("download-btn");

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function api(url) {
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Failed to load comparison");
    return data;
  }

  function renderStats(stats) {
    const items = [
      ["Added", stats.added || 0],
      ["Removed", stats.removed || 0],
      ["Modified", stats.modified || 0],
      ["Unchanged", stats.unchanged || 0],
    ];
    statsEl.innerHTML = items.map(([label, value]) => `<span class="gc-stat">${label}: ${value}</span>`).join("");
  }

  function renderFiles(files) {
    if (!files.length) {
      fileList.innerHTML = '<p class="gc-muted">No file differences found.</p>';
      return;
    }
    fileList.innerHTML = files
      .map((file, index) => `
        <button type="button" class="gc-file-item" data-index="${index}" ${file.skipped ? "disabled" : ""}>
          <span>${escapeHtml(file.path)}</span>
          <span class="gc-badge gc-badge-${file.skipped ? "skipped" : file.status}">${escapeHtml(file.status)}</span>
        </button>`)
      .join("");

    fileList.querySelectorAll(".gc-file-item:not([disabled])").forEach((button) => {
      button.addEventListener("click", () => {
        const file = files[Number(button.dataset.index)];
        diffTitle.textContent = file.path;
        diffLeft.textContent = file.left || "";
        diffRight.textContent = file.right || "";
        diffUnified.textContent = file.unified_diff || "";
        diffPanel.hidden = false;
      });
    });
  }

  closeDiff.addEventListener("click", () => {
    diffPanel.hidden = true;
  });

  downloadBtn.addEventListener("click", () => {
    window.location.href = `/git-compare/api/history/${entryId}/download`;
  });

  api(`/git-compare/api/history/${entryId}`)
    .then((entry) => {
      meta.textContent = `${entry.from_repo} (${entry.from_ref_type}: ${entry.from_ref}) → ${entry.to_repo} (${entry.to_ref_type}: ${entry.to_ref})`;
      renderStats(entry.stats || {});
      renderFiles(entry.files || []);
    })
    .catch((err) => {
      meta.textContent = err.message;
    });
})();
