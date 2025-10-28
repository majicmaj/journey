import type { DailyEntry, Habit } from "@/types/habit";

function getQuantityThresholds(h: Habit): {
  min: number | null;
  max: number | null;
} {
  if (h.minQuantity != null || h.maxQuantity != null) {
    return { min: h.minQuantity ?? null, max: h.maxQuantity ?? null };
  }
  // Legacy mapping for quantified
  if (h.kind === "quantified") {
    const min = h.min ?? h.target ?? null;
    const max = h.max ?? null;
    return { min, max };
  }
  return { min: null, max: null };
}

function getTimeThresholds(h: Habit): {
  min: number | null;
  max: number | null;
} {
  if (h.minTimeMinutes != null || h.maxTimeMinutes != null) {
    return { min: h.minTimeMinutes ?? null, max: h.maxTimeMinutes ?? null };
  }
  // Legacy mapping for time
  if (h.kind === "time") {
    const min = h.min ?? h.target ?? null;
    const max = h.max ?? null;
    return { min, max };
  }
  return { min: null, max: null };
}

function meetsOneDimension(
  min: number | null,
  max: number | null,
  value: number | null
): boolean {
  if (value == null) return false;
  if (min != null && max != null) {
    if (min > max) return false;
    return value >= min && value <= max;
  }
  if (min != null) return value >= min;
  if (max != null) return value <= max;
  // No thresholds => dimension not required
  return true;
}

export function meetsCompletionThresholds(
  h: Habit,
  entry:
    | Pick<DailyEntry, "quantity" | "startMinutes" | "endMinutes" | "logs">
    | null
    | undefined
): boolean {
  const { min: qMin, max: qMax } = getQuantityThresholds(h);
  const { min: windowStart, max: windowEnd } = getTimeThresholds(h);
  const minDur = h.minDurationMinutes ?? null;
  const maxDur = h.maxDurationMinutes ?? null;

  // Normalize to logs array
  const logs = (entry?.logs ?? []).length
    ? (entry!.logs as NonNullable<DailyEntry["logs"]>)
    : [
        {
          id: "single",
          quantity: entry?.quantity ?? null,
          startMinutes: entry?.startMinutes ?? null,
          endMinutes: entry?.endMinutes ?? null,
        },
      ];

  // Check each log falls within time window if configured
  const eachWithinWindow = logs.every((log) => {
    if (windowStart == null && windowEnd == null) return true;
    if (log.startMinutes == null || log.endMinutes == null) return false;
    const s = log.startMinutes;
    const e = log.endMinutes;
    if (windowStart != null && s < windowStart) return false;
    if (windowEnd != null && e > windowEnd) return false;
    return true;
  });

  // Sum quantities and durations
  const totalQuantity = logs.reduce((sum, l) => sum + (l.quantity ?? 0), 0);
  const totalDuration = logs.reduce((sum, l) => {
    if (typeof l.startMinutes === "number" && typeof l.endMinutes === "number")
      return sum + Math.max(l.endMinutes - l.startMinutes, 0);
    return sum;
  }, 0);

  const hasQ = qMin != null || qMax != null;
  const hasWindow = windowStart != null || windowEnd != null;
  const hasDur = minDur != null || maxDur != null;

  const qOk = meetsOneDimension(qMin, qMax, totalQuantity);
  const durOk = meetsOneDimension(minDur, maxDur, totalDuration);

  if (hasQ && hasDur) return qOk && durOk && eachWithinWindow; // both + window
  if (hasDur) return durOk && eachWithinWindow;
  if (hasWindow) return eachWithinWindow;
  if (hasQ) return qOk;
  // No thresholds configured -> not required to meet anything
  return true;
}

export function requiresValueForCompletion(h: Habit): boolean {
  const { min: qMin, max: qMax } = getQuantityThresholds(h);
  const { min: tMin, max: tMax } = getTimeThresholds(h);
  return qMin != null || qMax != null || tMin != null || tMax != null;
}

// Back-compat helper used by older inline value flows (single numeric value)
export function computeNextEntryOnSetValue(
  h: Habit,
  currentCompleted: boolean | undefined,
  nextValue: number | null
): { completed: boolean; value: number | null } {
  const requires = requiresValueForCompletion(h);
  // Choose which dimension this numeric value maps to: prefer quantity unless only time thresholds exist
  const { min: qMin, max: qMax } = getQuantityThresholds(h);
  const { min: tMin, max: tMax } = getTimeThresholds(h);
  const qNeeded = qMin != null || qMax != null;
  const tNeeded = tMin != null || tMax != null;

  const entry: Pick<DailyEntry, "quantity" | "startMinutes" | "endMinutes"> =
    qNeeded || !tNeeded
      ? { quantity: nextValue, startMinutes: null, endMinutes: null }
      : { quantity: null, startMinutes: 0, endMinutes: nextValue ?? 0 };

  const shouldComplete = requires
    ? meetsCompletionThresholds(h, entry)
    : Boolean(currentCompleted);
  return { completed: shouldComplete, value: nextValue };
}
