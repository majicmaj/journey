import type { Habit } from "@/types/habit";

export function meetsCompletionThresholds(
  h: Habit,
  value: number | null | undefined
): boolean {
  if (h.kind !== "quantified" && h.kind !== "time") return false;

  const v = typeof value === "number" && Number.isFinite(value) ? value : null;
  if (v == null) return false;

  const min = h.min ?? h.target ?? null;
  const max = h.max ?? null;

  if (min != null && max != null) {
    if (min > max) return false;
    return v >= min && v <= max;
  }

  if (min != null) return v >= min;
  if (max != null) return v <= max;

  return true;
}

export function requiresValueForCompletion(h: Habit): boolean {
  if (h.kind !== "quantified" && h.kind !== "time") return false;
  return h.min != null || h.max != null || h.target != null;
}

export function computeNextEntryOnSetValue(
  h: Habit,
  currentCompleted: boolean | undefined,
  nextValue: number | null
): { completed: boolean; value: number | null } {
  const requires = requiresValueForCompletion(h);
  const shouldComplete = requires
    ? meetsCompletionThresholds(h, nextValue)
    : Boolean(currentCompleted);
  return { completed: shouldComplete, value: nextValue };
}
