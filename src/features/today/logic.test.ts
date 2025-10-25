import { describe, it, expect } from "vitest";
import type { Habit } from "@/types/habit";
import {
  computeNextEntryOnSetValue,
  meetsCompletionThresholds,
  requiresValueForCompletion,
} from "./logic";

describe("today logic", () => {
  const base: Habit = {
    id: "h1",
    title: "Exercise",
    weight: 1,
    kind: "quantified",
    createdAt: new Date().toISOString(),
  };

  it("allows saving value without forcing completion when no thresholds", () => {
    const h: Habit = { ...base, target: null, min: null, max: null };
    expect(requiresValueForCompletion(h)).toBe(false);
    const next = computeNextEntryOnSetValue(h, false, 3);
    expect(next.value).toBe(3);
    expect(next.completed).toBe(false);
  });

  it("completes when thresholds are met", () => {
    const h: Habit = { ...base, target: 30 };
    expect(requiresValueForCompletion(h)).toBe(true);
    expect(meetsCompletionThresholds(h, 20)).toBe(false);
    expect(meetsCompletionThresholds(h, 30)).toBe(true);
    const next = computeNextEntryOnSetValue(h, false, 30);
    expect(next.completed).toBe(true);
  });

  it("time kind behaves similarly", () => {
    const h: Habit = { ...base, kind: "time", min: 30, max: 120 };
    expect(meetsCompletionThresholds(h, 25)).toBe(false);
    expect(meetsCompletionThresholds(h, 60)).toBe(true);
    const next = computeNextEntryOnSetValue(h, false, 60);
    expect(next.completed).toBe(true);
  });
});
