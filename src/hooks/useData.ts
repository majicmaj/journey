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
  return { ...query, create, update };
}

export function useEntries(dateKey: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["entries", dateKey],
    queryFn: async () => db.entries.where("date").equals(dateKey).toArray(),
  });
  const upsert = useMutation({
    mutationFn: async (entry: DailyEntry) => db.entries.put(entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", dateKey] }),
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
