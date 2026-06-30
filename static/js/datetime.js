/**
 * Shared date/time helpers for Syntra.
 *
 * Storage conventions (SQLite):
 * - Server timestamps (created_at, updated_at, comments): UTC "YYYY-MM-DD HH:MM:SS"
 * - Reminder remind_at: datetime-local "YYYY-MM-DDTHH:MM" (local, no timezone)
 * - Due dates: date-only "YYYY-MM-DD"
 */
(function (global) {
  "use strict";

  const SQLITE_UTC_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;
  const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;
  const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
  const TZ_PATTERN = /[zZ]$|[+-]\d{2}:\d{2}$/;

  function parseLocalDateTimeParts(text) {
    const [datePart, timePart] = text.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const timeBits = timePart.split(":");
    const hour = Number(timeBits[0]);
    const minute = Number(timeBits[1]);
    const second = timeBits[2] ? Number(String(timeBits[2]).split(".")[0]) : 0;
    const date = new Date(year, month - 1, day, hour, minute, second, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function parseStoredDateTime(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const text = String(value).trim();
    if (!text) return null;

    if (TZ_PATTERN.test(text)) {
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (DATETIME_LOCAL_PATTERN.test(text)) {
      return parseLocalDateTimeParts(text);
    }

    if (SQLITE_UTC_PATTERN.test(text)) {
      const date = new Date(`${text.replace(" ", "T")}Z`);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (ISO_UTC_PATTERN.test(text)) {
      const date = new Date(`${text}Z`);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = parseStoredDateTime(value);
    if (!date) return String(value);
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function toLocalDateTimeValue(value) {
    if (!value) return "";
    const date = parseStoredDateTime(value);
    if (!date) return String(value).slice(0, 16);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  function formatDateInput(value) {
    if (!value) return "";
    return String(value).slice(0, 10);
  }

  function localDateString(date = new Date()) {
    const parsed = parseStoredDateTime(date) || date;
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function isToday(dateStr) {
    if (!dateStr) return false;
    return String(dateStr).slice(0, 10) === localDateString();
  }

  function isOverdue(dateStr) {
    if (!dateStr) return false;
    return String(dateStr).slice(0, 10) < localDateString();
  }

  function nowFormatted() {
    return formatDateTime(new Date());
  }

  global.SyntraDateTime = {
    parseStoredDateTime,
    formatDateTime,
    toLocalDateTimeValue,
    formatDateInput,
    localDateString,
    isToday,
    isOverdue,
    nowFormatted,
  };
})(window);
