export const APP_TIMEZONE = "Europe/Rome";

export function todayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function nowSqliteDatetime(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export function formatDateInRome(value: string): string {
  const normalized = value.trim().replace("T", " ");
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
  );

  if (match) {
    const [, year, month, day, hour, minute, second = "00"] = match;
    return `${day}/${month}/${year}, ${hour}:${minute}:${second}`;
  }

  const hasTimezone = /[zZ]$|[+-]\d{2}:\d{2}$/.test(normalized);
  const parsed = new Date(hasTimezone ? normalized : `${normalized}Z`);
  if (Number.isNaN(parsed.getTime())) {
    return normalized.slice(0, 19);
  }

  return new Intl.DateTimeFormat("it-IT", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
}

export function filenameDateStamp(): string {
  return todayIsoDate();
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const shifted = new Date(utc + days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

export function dateRangeForShortcut(
  shortcut: "day" | "week" | "month",
): { from: string; to: string } {
  const to = todayIsoDate();
  const days =
    shortcut === "day" ? 0 : shortcut === "week" ? 6 : 29;
  return { from: addDaysToIsoDate(to, -days), to };
}

export function datetimeStartOfDay(isoDate: string): string {
  return `${isoDate} 00:00:00`;
}

export function datetimeEndOfDay(isoDate: string): string {
  return `${isoDate} 23:59:59`;
}
