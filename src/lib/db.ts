import Dexie, { type Table } from "dexie";
import type { DailyEntry, Habit } from "@/types/habit";

export interface Settings {
  id: string; // singleton key "settings"
  dayStart: string; // "HH:mm"
  inlineValueInput: boolean;
  showStreaks: boolean;
  // theming
  themePreset?: string; // e.g. "default", "ocean", ...
  themeDark?: boolean; // whether to apply the `dark` class on root
  themeVars?: Record<string, string>; // CSS variable overrides, keys without leading -- (e.g. "background")
  pixelFrameEnabled?: boolean; // whether to render pixel-frame or simple border
  pixelFrameWidth?: number; // pixel-frame width in px
  pixelFontEnabled?: boolean; // whether to use pixel art display font
  savedThemes?: Array<{
    id: string; // uuid
    name: string;
    dark: boolean;
    presetId: string | undefined;
    vars: Record<string, string>;
  }>;
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
  const defaults: Settings = {
    id: "settings",
    dayStart: "00:00",
    inlineValueInput: true,
    showStreaks: true,
    themePreset: "default",
    themeDark: false,
    themeVars: {},
    pixelFrameEnabled: true,
    pixelFrameWidth: 4,
    pixelFontEnabled: true,
    savedThemes: [],
  };
  if (existing) {
    // Backfill newly added fields for older records
    const upgraded: Settings = {
      ...defaults,
      ...existing,
      themeVars: existing.themeVars ?? {},
      themePreset: existing.themePreset ?? "default",
      themeDark: existing.themeDark ?? false,
      pixelFrameEnabled: existing.pixelFrameEnabled ?? true,
      pixelFrameWidth: existing.pixelFrameWidth ?? 4,
      pixelFontEnabled: existing.pixelFontEnabled ?? true,
      savedThemes: existing.savedThemes ?? [],
    };
    // Persist any backfilled fields so future reads are consistent
    if (
      upgraded.themeVars !== existing.themeVars ||
      upgraded.themePreset !== existing.themePreset ||
      upgraded.themeDark !== existing.themeDark ||
      upgraded.pixelFrameEnabled !== existing.pixelFrameEnabled ||
      upgraded.pixelFrameWidth !== existing.pixelFrameWidth ||
      upgraded.pixelFontEnabled !== existing.pixelFontEnabled
    ) {
      await db.settings.put(upgraded);
    }
    return upgraded;
  }
  await db.settings.put(defaults);
  return defaults;
}
