import { DateTime } from "luxon";

/** Returns YYYY-MM-DD in user TZ with custom dayStart ("HH:mm"). */
export function toDayKey(date: Date | string, dayStart: string): string {
  const [h, m] = parseDayStart(dayStart);
  const dt =
    typeof date === "string"
      ? DateTime.fromISO(date)
      : DateTime.fromJSDate(date);
  const local = dt.setZone("local");
  const shifted = local.minus({ hours: h, minutes: m });
  const key = shifted.toISODate();
  if (!key) throw new Error("Failed to derive day key");
  return key;
}

/** Parses "HH:mm" to [hours, minutes]. */
export function parseDayStart(input: string): [number, number] {
  const match = /^(\d{2}):(\d{2})$/.exec(input);
  if (!match) return [0, 0];
  const hours = clampInt(parseInt(match[1], 10), 0, 23);
  const minutes = clampInt(parseInt(match[2], 10), 0, 59);
  return [hours, minutes];
}

export function isFuture(dateKey: string, dayStart: string): boolean {
  const todayKey = toDayKey(new Date(), dayStart);
  return dateKey > todayKey;
}

function clampInt(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
