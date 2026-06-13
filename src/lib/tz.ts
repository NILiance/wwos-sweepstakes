// Platform operates on Eastern time; users/commissioners can override.
export const PLATFORM_TZ = "America/New_York";

const COMMON_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];
export const TIMEZONES = COMMON_ZONES;

/** Format an ISO/Date in a timezone (defaults to Eastern). */
export function fmt(
  date: string | Date | null,
  tz: string = PLATFORM_TZ,
  opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
): string {
  if (!date) return "TBD";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(d) +
    " " +
    shortZone(tz, d);
}

export function fmtDate(
  date: string | Date | null,
  tz: string = PLATFORM_TZ,
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: tz,
  }).format(d);
}

/** Short zone abbreviation (EST/EDT/CST…) for the given instant. */
export function shortZone(tz: string, d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "short",
  }).formatToParts(d);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/**
 * Convert a local datetime-local string (YYYY-MM-DDTHH:mm) entered in `tz`
 * into a UTC ISO string for storage.
 */
export function localToUtc(local: string, tz: string): string | null {
  if (!local) return null;
  // Interpret the wall-clock time as being in tz
  const [datePart, timePart] = local.split("T");
  const [y, mo, da] = datePart.split("-").map(Number);
  const [h, mi] = (timePart ?? "00:00").split(":").map(Number);
  // Build a UTC guess, then correct by the zone offset at that instant
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  const asTz = new Date(
    new Date(guess).toLocaleString("en-US", { timeZone: tz }),
  ).getTime();
  const asUtc = new Date(
    new Date(guess).toLocaleString("en-US", { timeZone: "UTC" }),
  ).getTime();
  const offset = asTz - asUtc;
  return new Date(guess - offset).toISOString();
}

/** A UTC ISO string formatted as a value for a datetime-local input in tz. */
export function utcToLocalInput(iso: string | null, tz: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
