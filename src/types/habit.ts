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
  // value can represent different kinds depending on when it was logged
  // quantified/time -> number (for time: minutes), boolean -> boolean (optional)
  value?: number | boolean | null; // detailed logging
  // snapshot of the habit kind at the time of logging to preserve history
  kindAtEntry?: Habit["kind"]; // "boolean" | "quantified" | "time"
  note?: string | null;
  editedAt?: string;
}

export interface DaySummaryByHabit {
  habitId: HabitId;
  contribution: number; // 0..100 after normalization per habit
  completed: boolean;
  value?: number | boolean | null;
}

export interface DaySummary {
  date: string;
  totalScore: number; // 0..100
  byHabit: DaySummaryByHabit[];
}
