"""Standalone HTML export for Git comparisons."""

from __future__ import annotations

import html
from typing import Any


def render_comparison_html(comparison: dict[str, Any], title: str = "Git Comparison Report") -> str:
    from_label = _ref_label(comparison.get("from") or {})
    to_label = _ref_label(comparison.get("to") or {})
    stats = comparison.get("stats") or {}
    files = comparison.get("files") or []

    file_sections = []
    for item in files:
        if item.get("skipped"):
            file_sections.append(
                f"""
                <section class="file-block skipped">
                  <h2>{html.escape(item.get("path", ""))} <span class="badge">{html.escape(item.get("status", ""))}</span></h2>
                  <p class="muted">{html.escape(item.get("reason", "Skipped"))}</p>
                </section>
                """
            )
            continue

        file_sections.append(
            f"""
            <section class="file-block">
              <h2>{html.escape(item.get("path", ""))} <span class="badge">{html.escape(item.get("status", ""))}</span></h2>
              <div class="diff-grid">
                <div class="diff-pane">
                  <div class="pane-header">From — {html.escape(from_label)}</div>
                  <pre>{html.escape(item.get("left") or "")}</pre>
                </div>
                <div class="diff-pane">
                  <div class="pane-header">To — {html.escape(to_label)}</div>
                  <pre>{html.escape(item.get("right") or "")}</pre>
                </div>
              </div>
              <details>
                <summary>Unified diff</summary>
                <pre class="unified">{html.escape(item.get("unified_diff") or "")}</pre>
              </details>
            </section>
            """
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(title)}</title>
  <style>
    body {{ font-family: Inter, system-ui, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }}
    header {{ background: #fff; border-bottom: 1px solid #e2e8f0; padding: 1.5rem 2rem; }}
    h1 {{ margin: 0 0 0.5rem; font-size: 1.5rem; }}
    .meta {{ color: #475569; font-size: 0.95rem; }}
    .stats {{ display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }}
    .stat {{ background: #eef2ff; color: #312e81; padding: 0.35rem 0.75rem; border-radius: 999px; font-size: 0.85rem; }}
    main {{ padding: 1.5rem 2rem 3rem; }}
    .file-block {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 1rem; overflow: hidden; }}
    .file-block h2 {{ margin: 0; padding: 1rem 1.25rem; font-size: 1rem; border-bottom: 1px solid #e2e8f0; }}
    .badge {{ text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.04em; color: #7c3aed; }}
    .diff-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 0; }}
    .diff-pane {{ border-right: 1px solid #e2e8f0; min-width: 0; }}
    .diff-pane:last-child {{ border-right: none; }}
    .pane-header {{ background: #f1f5f9; padding: 0.6rem 1rem; font-size: 0.8rem; color: #475569; }}
    pre {{ margin: 0; padding: 1rem; white-space: pre-wrap; word-break: break-word; font-size: 0.8rem; line-height: 1.45; }}
    details {{ border-top: 1px solid #e2e8f0; }}
    summary {{ cursor: pointer; padding: 0.75rem 1.25rem; background: #fafafa; }}
    .unified {{ background: #0f172a; color: #e2e8f0; }}
    .muted {{ color: #64748b; padding: 1rem 1.25rem; }}
    @media (max-width: 900px) {{ .diff-grid {{ grid-template-columns: 1fr; }} .diff-pane {{ border-right: none; border-bottom: 1px solid #e2e8f0; }} }}
  </style>
</head>
<body>
  <header>
    <h1>{html.escape(title)}</h1>
    <div class="meta">From <strong>{html.escape(from_label)}</strong> → To <strong>{html.escape(to_label)}</strong></div>
    <div class="stats">
      <span class="stat">Added: {stats.get("added", 0)}</span>
      <span class="stat">Removed: {stats.get("removed", 0)}</span>
      <span class="stat">Modified: {stats.get("modified", 0)}</span>
      <span class="stat">Unchanged: {stats.get("unchanged", 0)}</span>
    </div>
  </header>
  <main>
    {''.join(file_sections) if file_sections else '<p class="muted">No file differences found.</p>'}
  </main>
</body>
</html>"""


def _ref_label(side: dict[str, Any]) -> str:
    repo = side.get("repo") or {}
    slug = repo.get("slug") or "unknown"
    ref = side.get("ref") or ""
    ref_type = side.get("ref_type") or "ref"
    return f"{slug} ({ref_type}: {ref})"


def comparison_from_history(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "from": {
            "repo": _repo_dict(entry.get("from_repo")),
            "ref": entry.get("from_ref"),
            "ref_type": entry.get("from_ref_type"),
        },
        "to": {
            "repo": _repo_dict(entry.get("to_repo")),
            "ref": entry.get("to_ref"),
            "ref_type": entry.get("to_ref_type"),
        },
        "stats": entry.get("stats") or {},
        "files": entry.get("files") or [],
    }


def _repo_dict(slug: str | None) -> dict[str, str]:
    slug = slug or ""
    if "/" in slug:
        owner, name = slug.split("/", 1)
        return {"slug": slug, "owner": owner, "name": name}
    return {"slug": slug, "owner": "", "name": slug}
