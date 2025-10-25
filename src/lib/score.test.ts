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

  it("uses entry.kindAtEntry=boolean when habit is now quantified", () => {
    // Habit currently quantified with target 10
    const nowQuant: Habit = {
      id: "h3",
      title: "Reading",
      weight: 1,
      kind: "quantified",
      target: 10,
      createdAt: new Date().toISOString(),
    };
    // Entry was logged when it was a boolean habit
    const e: DailyEntry = {
      habitId: "h3",
      date: "2024-01-02",
      completed: true,
      kindAtEntry: "boolean",
    };
    // Should score as completed boolean → 1
    expect(contributionRaw(e, nowQuant)).toBe(1);
    const { totalScore } = computeDaySummary("2024-01-02", [nowQuant], [e]);
    expect(totalScore).toBe(100);
  });

  it("treats numeric value when kindAtEntry is time but habit is now boolean", () => {
    // Habit currently boolean
    const nowBool: Habit = {
      id: "h4",
      title: "Meditate",
      weight: 1,
      kind: "boolean",
      createdAt: new Date().toISOString(),
    };
    // Historical entry was time-based with 30 minutes
    const e: DailyEntry = {
      habitId: "h4",
      date: "2024-01-03",
      value: 30,
      kindAtEntry: "time",
    };
    // With no thresholds, numeric scaling treats value as max → full credit 1
    expect(contributionRaw(e, nowBool)).toBe(1);
    const { totalScore } = computeDaySummary("2024-01-03", [nowBool], [e]);
    expect(totalScore).toBe(100);
  });
});
