import { StockError } from "./errors.js";

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function roundQty(n) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function istDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function parseShopDate(value) {
  const raw = value == null || value === "" ? istDateKey() : String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) {
    throw new StockError("Date must be YYYY-MM-DD.");
  }
  const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) {
    throw new StockError("Date must be YYYY-MM-DD.");
  }
  return parsed;
}

export function todayRange(now = new Date()) {
  const start = parseShopDate(istDateKey(now));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
