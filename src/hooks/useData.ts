import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, getOrInitSettings } from "@/lib/db";
import type { DailyEntry, Habit } from "@/types/habit";
import { computeDaySummary } from "@/lib/score";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: getOrInitSettings,
  });
}

export function useHabits() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["habits"],
    queryFn: async () => db.habits.toArray(),
  });
  const create = useMutation({
    mutationFn: async (habit: Habit) => db.habits.put(habit),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });
  const update = useMutation({
    mutationFn: async (habit: Habit) => db.habits.put(habit),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });
  const remove = useMutation({
    mutationFn: async (habitId: string) => {
      // Remove the habit and all its entries in a single transaction
      await db.transaction("rw", db.habits, db.entries, async () => {
        await db.entries.where("habitId").equals(habitId).delete();
        await db.habits.delete(habitId);
      });
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["entries-range"] });
    },
  });
  return { ...query, create, update, remove };
}

export function useEntries(dateKey: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["entries", dateKey],
    queryFn: async () => db.entries.where("date").equals(dateKey).toArray(),
  });
  const upsert = useMutation({
    mutationFn: async (entry: DailyEntry) => db.entries.put(entry),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries", dateKey] });
      qc.invalidateQueries({ queryKey: ["entries-range"] });
    },
  });
  return { ...query, upsert };
}

export function useDaySummary(dateKey: string) {
  const habitsQ = useHabits();
  const entriesQ = useEntries(dateKey);
  const summary = (() => {
    if (!habitsQ.data || !entriesQ.data) return undefined;
    const { totalScore, byHabit } = computeDaySummary(
      dateKey,
      habitsQ.data,
      entriesQ.data
    );
    return { date: dateKey, totalScore, byHabit };
  })();
  return { habitsQ, entriesQ, summary };
}

export function useDailySummariesRange(fromKey: string, toKey: string) {
  const habitsQ = useHabits();
  const rangeQ = useQuery({
    queryKey: ["entries-range", fromKey, toKey],
    queryFn: async () =>
      db.entries.where("date").between(fromKey, toKey, true, true).toArray(),
  });
  const summaries = (() => {
    if (!habitsQ.data || !rangeQ.data) return undefined;
    const entriesByDate = new Map<string, DailyEntry[]>();
    for (const e of rangeQ.data) {
      const arr = entriesByDate.get(e.date) ?? [];
      arr.push(e);
      entriesByDate.set(e.date, arr);
    }
    const out: Array<{ date: string; totalScore: number }> = [];
    for (const [date, list] of entriesByDate) {
      const { totalScore } = computeDaySummary(date, habitsQ.data, list);
      out.push({ date, totalScore });
    }
    for (const d of enumerateDateKeys(fromKey, toKey)) {
      if (!out.find((x) => x.date === d)) out.push({ date: d, totalScore: 0 });
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  })();
  return { habitsQ, rangeQ, summaries };
}

function enumerateDateKeys(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  const start = new Date(fromKey + "T00:00:00");
  const end = new Date(toKey + "T00:00:00");
  const cur = new Date(start);
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    out.push(key);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
