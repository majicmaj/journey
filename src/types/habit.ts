export type HabitId = string;
export type Unit = string;

export interface Habit {
  id: HabitId;
  title: string;
  icon?: string;
  color?: string;
  tags?: string[];
  weight: number; // default 1.0, [0.1 .. 5.0]
  kind: "boolean" | "quantified" | "time";
  unit?: Unit;
  target?: number | null;
  min?: number | null;
  max?: number | null;
  createdAt: string; // ISO
  archivedAt?: string | null;
}

export interface DailyEntry {
  habitId: HabitId;
  date: string; // YYYY-MM-DD (user TZ, respecting day start)
  completed?: boolean; // compact logging
  value?: number | null; // detailed logging
  note?: string | null;
  editedAt?: string;
}

export interface DaySummaryByHabit {
  habitId: HabitId;
  contribution: number; // 0..100 after normalization per habit
  completed: boolean;
  value?: number | null;
}

export interface DaySummary {
  date: string;
  totalScore: number; // 0..100
  byHabit: DaySummaryByHabit[];
}
