import type { DailyEntry, Habit } from "@/types/habit";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function contributionRaw(
  entry: DailyEntry | undefined,
  habit: Habit
): number {
  if (!entry) return 0;
  if (habit.kind === "boolean") {
    return entry.completed ? 1 : 0;
  }
  const value = typeof entry.value === "number" ? entry.value : 0;
  const { target, min, max } = habit;
  if (target != null) {
    const ratio = target === 0 ? 0 : value / target;
    return clamp(ratio, 0, 1.1);
  }
  const minV = min ?? 0;
  const maxV = max ?? Math.max(minV, value);
  const span = maxV - minV || 1;
  return clamp((value - minV) / span, 0, 1.1);
}

export function computeDaySummary(
  dateKey: string,
  habits: Habit[],
  entries: DailyEntry[]
): {
  totalScore: number;
  byHabit: Array<{
    habitId: string;
    contribution: number;
    completed: boolean;
    value?: number | null;
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
      return {
        habitId: h.id,
        contribution: Math.round(clamp(raw, 0, 1) * 100),
        completed: h.kind === "boolean" ? Boolean(e?.completed) : raw >= 1,
        value: e?.value,
      };
    });

  const totalScore =
    sumMax === 0 ? 0 : Math.round(clamp(sumWeighted / sumMax, 0, 1) * 100);
  return { totalScore, byHabit };
}
