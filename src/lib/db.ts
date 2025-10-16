import Dexie, { type Table } from "dexie";
import type { DailyEntry, Habit } from "@/types/habit";

export interface Settings {
  id: string; // singleton key "settings"
  dayStart: string; // "HH:mm"
  inlineValueInput: boolean;
  showStreaks: boolean;
}

class HabitDB extends Dexie {
  habits!: Table<Habit, string>;
  entries!: Table<DailyEntry, [string, string]>; // [habitId, date]
  settings!: Table<Settings, string>;

  constructor() {
    super("habit_db_v1");
    this.version(1).stores({
      habits: "id, createdAt, archivedAt",
      entries: "[habitId+date], date, habitId",
      settings: "id",
    });
  }
}

export const db = new HabitDB();

export async function getOrInitSettings(): Promise<Settings> {
  const existing = await db.settings.get("settings");
  if (existing) return existing;
  const defaults: Settings = {
    id: "settings",
    dayStart: "00:00",
    inlineValueInput: false,
    showStreaks: false,
  };
  await db.settings.put(defaults);
  return defaults;
}
