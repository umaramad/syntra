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

const required = ["constants", "state", "core", "ui", "profile", "settings", "search", "reminders", "tasks", "mcp", "app"];
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
console.log(
  "Exports:",
  Object.keys(window.Syntra)
    .filter((k) => typeof window.Syntra[k] === "object")
    .join(", ")
);
