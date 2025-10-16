import { describe, it, expect } from "vitest";
import { contributionRaw, computeDaySummary } from "./score";
import type { DailyEntry, Habit } from "@/types/habit";

const boolHabit: Habit = {
  id: "h1",
  title: "Drink water",
  weight: 1,
  kind: "boolean",
  createdAt: new Date().toISOString(),
};

const quantHabitTarget: Habit = {
  id: "h2",
  title: "Run",
  weight: 1,
  kind: "quantified",
  target: 5,
  createdAt: new Date().toISOString(),
};

describe("score", () => {
  it("boolean contribution", () => {
    expect(contributionRaw(undefined, boolHabit)).toBe(0);
    expect(
      contributionRaw({ habitId: "h1", date: "2024-01-01" }, boolHabit)
    ).toBe(0);
    expect(
      contributionRaw(
        { habitId: "h1", date: "2024-01-01", completed: true },
        boolHabit
      )
    ).toBe(1);
  });

  it("quantified target contribution with clamp 1.1", () => {
    expect(
      contributionRaw(
        { habitId: "h2", date: "2024-01-01", value: 2.5 },
        quantHabitTarget
      )
    ).toBeCloseTo(0.5);
    expect(
      contributionRaw(
        { habitId: "h2", date: "2024-01-01", value: 6 },
        quantHabitTarget
      )
    ).toBeCloseTo(1.1);
  });

  it("day summary normalization 0..100", () => {
    const habits = [boolHabit, quantHabitTarget];
    const entries: DailyEntry[] = [
      { habitId: "h1", date: "2024-01-01", completed: true },
      { habitId: "h2", date: "2024-01-01", value: 2.5 },
    ];
    const { totalScore } = computeDaySummary("2024-01-01", habits, entries);
    expect(totalScore).toBe(75); // (1 + 0.5)/2 = 0.75 → 75
  });
});
