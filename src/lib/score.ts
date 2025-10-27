import type { DailyEntry, Habit } from "@/types/habit";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getQuantityValue(entry: DailyEntry | undefined): number | null {
  if (!entry) return null;
  if (typeof entry.quantity === "number" && Number.isFinite(entry.quantity)) {
    return entry.quantity;
  }
  // Legacy fallback: when a numeric value existed for quantified entries
  if (
    typeof entry.value === "number" &&
    (entry.kindAtEntry === "quantified" || !entry.kindAtEntry)
  ) {
    return entry.value;
  }
  return null;
}

function getTimeMinutes(entry: DailyEntry | undefined): number | null {
  if (!entry) return null;
  if (
    typeof entry.startMinutes === "number" &&
    typeof entry.endMinutes === "number"
  ) {
    return Math.max(entry.endMinutes - entry.startMinutes, 0);
  }
  // Legacy fallback: numeric value when kind was time
  if (
    typeof entry.value === "number" &&
    (entry.kindAtEntry === "time" || !entry.kindAtEntry)
  ) {
    return entry.value;
  }
  return null;
}

function normalize(
  value: number | null,
  min: number | null | undefined,
  max: number | null | undefined
): number | null {
  if (value == null) return null;
  const minV = typeof min === "number" ? min : 0;
  const maxV = typeof max === "number" ? max : Math.max(minV, value);
  const span = maxV - minV || 1;
  return clamp((value - minV) / span, 0, 1.1);
}

function getQuantityScore(
  entry: DailyEntry | undefined,
  habit: Habit
): number | null {
  // Prefer unified thresholds
  const raw = getQuantityValue(entry);
  if (habit.minQuantity != null || habit.maxQuantity != null) {
    return normalize(raw, habit.minQuantity ?? null, habit.maxQuantity ?? null);
  }
  // Legacy mapping for quantified
  if (habit.kind === "quantified") {
    const { target, min, max } = habit;
    if (raw == null) return null;
    if (target != null) {
      const ratio = target === 0 ? 0 : raw / target;
      return clamp(ratio, 0, 1.1);
    }
    return normalize(raw, min ?? null, max ?? null);
  }
  // Fallback: if we have a raw quantity but no thresholds, treat it as full credit
  if (raw != null) return normalize(raw, null, null);
  return null;
}

function getTimeScore(
  entry: DailyEntry | undefined,
  habit: Habit
): number | null {
  const minutes = getTimeMinutes(entry);
  if (habit.minTimeMinutes != null || habit.maxTimeMinutes != null) {
    return normalize(
      minutes,
      habit.minTimeMinutes ?? null,
      habit.maxTimeMinutes ?? null
    );
  }
  // Legacy mapping for time
  if (habit.kind === "time") {
    const { target, min, max } = habit;
    if (minutes == null) return null;
    if (target != null) {
      const ratio = target === 0 ? 0 : minutes / target;
      return clamp(ratio, 0, 1.1);
    }
    return normalize(minutes, min ?? null, max ?? null);
  }
  // Fallback: if we have minutes but no thresholds, treat it as full credit
  if (minutes != null) return normalize(minutes, null, null);
  return null;
}

export function contributionRaw(
  entry: DailyEntry | undefined,
  habit: Habit
): number {
  if (!entry) return 0;
  const quantityScore = getQuantityScore(entry, habit);
  const timeScore = getTimeScore(entry, habit);

  const mode = habit.scoreMode ?? "both";
  if (mode === "quantity" && quantityScore != null) return quantityScore;
  if (mode === "time" && timeScore != null) return timeScore;
  if (mode === "both") {
    if (quantityScore != null && timeScore != null) {
      return (quantityScore + timeScore) / 2;
    }
    if (quantityScore != null) return quantityScore;
    if (timeScore != null) return timeScore;
  }
  // If no numeric dimensions are configured, fall back to completed boolean
  return entry.completed ? 1 : 0;
}

export function computeDaySummary(
  _dateKey: string,
  habits: Habit[],
  entries: DailyEntry[]
): {
  totalScore: number;
  byHabit: Array<{
    habitId: string;
    contribution: number;
    completed: boolean;
    value?: number | boolean | null;
  }>;
} {
  const entryByHabit = new Map<string, DailyEntry>();
  for (const e of entries) entryByHabit.set(e.habitId, e);

  let sumWeighted = 0;
  let sumMax = 0;
  const byHabit = habits
    .filter((h) => !h.archivedAt)
    .map((h) => {
      const e = entryByHabit.get(h.id);
      const raw = contributionRaw(e, h);
      const weighted = raw * h.weight;
      sumWeighted += weighted;
      sumMax += h.weight;
      // Choose a representative value for display: prefer quantity, else time, else legacy value
      const displayValue =
        getQuantityValue(e) ?? getTimeMinutes(e) ?? e?.value ?? null;
      return {
        habitId: h.id,
        contribution: Math.round(clamp(raw, 0, 1) * 100),
        completed: Boolean(e?.completed),
        value: displayValue,
      };
    });

  const totalScore =
    sumMax === 0 ? 0 : Math.round(clamp(sumWeighted / sumMax, 0, 1) * 100);
  return { totalScore, byHabit };
}
