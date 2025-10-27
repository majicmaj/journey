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
    | Pick<DailyEntry, "quantity" | "startMinutes" | "endMinutes">
    | null
    | undefined
): boolean {
  const { min: qMin, max: qMax } = getQuantityThresholds(h);
  const { min: tMin, max: tMax } = getTimeThresholds(h);
  const quantity = entry?.quantity ?? null;
  const minutes =
    typeof entry?.startMinutes === "number" &&
    typeof entry?.endMinutes === "number"
      ? Math.max(entry!.endMinutes! - entry!.startMinutes!, 0)
      : null;

  const hasQ = qMin != null || qMax != null;
  const hasT = tMin != null || tMax != null;

  const qOk = meetsOneDimension(qMin, qMax, quantity);
  const tOk = meetsOneDimension(tMin, tMax, minutes);

  if (hasQ && hasT) return qOk && tOk; // BOTH as requested
  if (hasQ) return qOk;
  if (hasT) return tOk;
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
