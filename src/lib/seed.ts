import { db } from "@/lib/db";
import { toDayKey } from "@/lib/dates";
import type { DailyEntry, Habit } from "@/types/habit";

/** Seeds mock habits and entries for demo/testing without wiping user data. */
export async function seedMockData(options?: {
  days?: number;
  dayStart?: string;
}) {
  const days = options?.days ?? 90;
  const dayStart = options?.dayStart ?? "00:00";

  const nowIso = new Date().toISOString();

  // Remove previous mock data to avoid duplicates
  await db.transaction("rw", db.habits, db.entries, async () => {
    await db.entries.where("habitId").startsWith("mock-").delete();
    await db.habits.where("id").startsWith("mock-").delete();

    const habits: Habit[] = [
      {
        id: "mock-1",
        title: "Drink Water",
        weight: 1,
        kind: "boolean",
        createdAt: nowIso,
      },
      {
        id: "mock-2",
        title: "Read",
        weight: 1.2,
        kind: "quantified",
        unit: "pages",
        target: 20,
        createdAt: nowIso,
      },
      {
        id: "mock-3",
        title: "Run",
        weight: 1.5,
        kind: "quantified",
        unit: "km",
        target: 5,
        createdAt: nowIso,
      },
      {
        id: "mock-4",
        title: "Meditate",
        weight: 0.8,
        kind: "boolean",
        createdAt: nowIso,
      },
      {
        id: "mock-5",
        title: "Code Practice",
        weight: 1.3,
        kind: "quantified",
        unit: "mins",
        target: 30,
        createdAt: nowIso,
      },
    ];

    await db.habits.bulkPut(habits);

    const entries: DailyEntry[] = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = toDayKey(d, dayStart);

      for (const h of habits) {
        if (h.kind === "boolean") {
          const completed = Math.random() < 0.7; // 70% completion
          if (completed)
            entries.push({ habitId: h.id, date: dateKey, completed });
        } else {
          const base = h.target ?? 1;
          // random around target with some variance; sometimes zero
          const over = Math.random() < 0.15; // occasional over-achievement
          const miss = Math.random() < 0.15; // occasional miss
          const val = miss
            ? 0
            : base * (over ? 1.2 : 0.7 + Math.random() * 0.6);
          entries.push({
            habitId: h.id,
            date: dateKey,
            value: Math.round(val * 10) / 10,
          });
        }
      }
    }

    if (entries.length) await db.entries.bulkPut(entries);
  });
}
