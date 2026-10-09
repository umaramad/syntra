#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const jsDir = path.join(__dirname, "..", "static", "js");

const scripts = [
  "datetime.js",
  "syntra/bootstrap.js",
  "syntra/core.js",
  "syntra/ui.js",
  "syntra/profile.js",
  "syntra/settings.js",
  "syntra/search.js",
  "syntra/reminders.js",
  "syntra/tasks.js",
  "syntra/mcp.js",
  "syntra/availability.js",
  "syntra/app.js",
  "app.js",
];

const mockElements = new Map();

function makeEl(id) {
  const el = {
    id,
    value: "",
    checked: false,
    classList: {
      _set: new Set(),
      add(...args) {
        args.forEach((c) => this._set.add(c));
      },
      remove(...args) {
        args.forEach((c) => this._set.delete(c));
      },
      toggle(c, force) {
        if (force === true) this._set.add(c);
        else if (force === false) this._set.delete(c);
        else if (this._set.has(c)) this._set.delete(c);
        else this._set.add(c);
      },
      contains(c) {
        return this._set.has(c);
      },
    },
    style: {},
    dataset: {},
    innerHTML: "",
    textContent: "",
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    focus() {},
    click() {},
    setAttribute() {},
    getAttribute() {
      return null;
    },
    appendChild() {},
    remove() {},
    closest() {
      return null;
    },
  };
  mockElements.set(id, el);
  return el;
}

const document = {
  getElementById(id) {
    return mockElements.get(id) || null;
  },
  querySelector() {
    return null;
  },
  querySelectorAll(sel) {
    if (sel === ".nav-link") return [];
    if (sel === "[data-section]") return [];
    return [];
  },
  body: makeEl("body"),
  documentElement: { dataset: {}, classList: { add() {}, remove() {}, toggle() {} } },
  addEventListener() {},
  createElement(tag) {
    const el = makeEl(`dynamic-${tag}`);
    el.tagName = tag.toUpperCase();
    return el;
  },
};

const localStorage = {
  _data: {},
  getItem(k) {
    return this._data[k] ?? null;
  },
  setItem(k, v) {
    this._data[k] = String(v);
  },
  removeItem(k) {
    delete this._data[k];
  },
};

const matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const window = {
  Syntra: undefined,
  SyntraDateTime: undefined,
  document,
  localStorage,
  matchMedia,
  location: { hash: "" },
  addEventListener() {},
  removeEventListener() {},
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  requestAnimationFrame(cb) {
    cb();
  },
  setInterval() {
    return 1;
  },
  clearInterval() {},
  setTimeout(fn) {
    fn();
    return 1;
  },
  clearTimeout() {},
  fetch: async () => ({
    ok: true,
    json: async () => ({}),
    blob: async () => new Blob(),
    headers: { get: () => "application/json" },
  }),
  Notification: { permission: "default", requestPermission: async () => "default" },
  AudioContext: class {
    createOscillator() {
      return { connect() {}, start() {}, stop() {} };
    }
    createGain() {
      return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } };
    }
    get currentTime() {
      return 0;
    }
    close() {}
  },
  navigator: { clipboard: { writeText: async () => {}, write: async () => {} } },
};

window.window = window;
window.globalThis = window;

for (const rel of scripts) {
  const file = path.join(jsDir, rel);
  const code = fs.readFileSync(file, "utf8");
  vm.runInNewContext(code, window, { filename: file });
}

const required = ["constants", "state", "core", "ui", "profile", "settings", "search", "reminders", "tasks", "mcp", "availability", "app"];
const missing = required.filter((k) => !window.Syntra?.[k]);
if (missing.length) {
  console.error("Missing Syntra modules:", missing.join(", "));
  process.exit(1);
}

try {
  window.Syntra.app.initApp();
} catch (err) {
  console.error("initApp failed:", err.stack || err.message);
  process.exit(1);
}

console.log("OK: Syntra namespace loaded, initApp ran without error");

// Pure availability helper checks (spec: single-day hit, range covering a day,
// misses before/after, month-boundary span, availability exclusion, initials).
const { onLeaveOn, availableOn, initialsFor } = window.Syntra.availability;
const leaves = [
  { id: 1, team_member_id: 1, start_date: "2026-10-12", end_date: "2026-10-12" },
  { id: 2, team_member_id: 2, start_date: "2026-09-30", end_date: "2026-10-02" },
  { id: 3, team_member_id: 3, start_date: "2026-10-20", end_date: "2026-10-25" },
];
const members = [
  { id: 1, name: "Ada Lovelace" },
  { id: 2, name: "Grace" },
  { id: 3, name: "Alan Turing" },
  { id: 4, name: "Katherine Johnson" },
];
const checks = [
  [onLeaveOn(leaves, "2026-10-12").length === 1, "single-day leave hits its own date"],
  [onLeaveOn(leaves, "2026-10-11").length === 0, "day before a leave misses"],
  [onLeaveOn(leaves, "2026-10-13").length === 0, "day after a single-day leave misses"],
  [onLeaveOn(leaves, "2026-09-30").length === 1, "multi-day leave hits start date"],
  [onLeaveOn(leaves, "2026-10-01").length === 1, "leave spanning a month boundary hits in the next month"],
  [onLeaveOn(leaves, "2026-10-02").length === 1, "leave spanning a month boundary hits its end date"],
  [onLeaveOn(leaves, "2026-10-03").length === 0, "day after a multi-day leave misses"],
  [availableOn(members, leaves, "2026-10-12").length === 3, "available excludes members on leave"],
  [availableOn(members, leaves, "2026-10-15").length === 4, "everyone is available on a clear day"],
  [initialsFor("Ada Lovelace") === "AL", "initials from two words"],
  [initialsFor("Grace") === "GR", "initials from one word"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  failed.forEach(([, msg]) => console.error(`FAIL: ${msg}`));
  process.exit(1);
}
console.log(`OK: ${checks.length} availability helper checks passed`);
console.log(
  "Exports:",
  Object.keys(window.Syntra)
    .filter((k) => typeof window.Syntra[k] === "object")
    .join(", ")
);
