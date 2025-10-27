import { describe, it, expect } from "vitest";
import type { Habit, DailyEntry } from "@/types/habit";
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
    scoreMode: "both",
    createdAt: new Date().toISOString(),
  };

  it("allows saving value without forcing completion when no thresholds", () => {
    const h: Habit = { ...base };
    expect(requiresValueForCompletion(h)).toBe(false);
    const next = computeNextEntryOnSetValue(h, false, 3);
    expect(next.value).toBe(3);
    expect(next.completed).toBe(false);
  });

  it("completes when quantity thresholds are met", () => {
    const h: Habit = { ...base, minQuantity: 30 };
    expect(requiresValueForCompletion(h)).toBe(true);
    const e1: Pick<DailyEntry, "quantity" | "startMinutes" | "endMinutes"> = {
      quantity: 20,
      startMinutes: null,
      endMinutes: null,
    };
    expect(meetsCompletionThresholds(h, e1)).toBe(false);
    const e2: Pick<DailyEntry, "quantity" | "startMinutes" | "endMinutes"> = {
      quantity: 30,
      startMinutes: null,
      endMinutes: null,
    };
    expect(meetsCompletionThresholds(h, e2)).toBe(true);
  });

  it("time thresholds behave similarly", () => {
    const h: Habit = { ...base, minTimeMinutes: 30, maxTimeMinutes: 120 };
    const e1: Pick<DailyEntry, "quantity" | "startMinutes" | "endMinutes"> = {
      quantity: null,
      startMinutes: 0,
      endMinutes: 25,
    };
    expect(meetsCompletionThresholds(h, e1)).toBe(false);
    const e2: Pick<DailyEntry, "quantity" | "startMinutes" | "endMinutes"> = {
      quantity: null,
      startMinutes: 0,
      endMinutes: 60,
    };
    expect(meetsCompletionThresholds(h, e2)).toBe(true);
  });

  it("requires BOTH when both dimensions present", () => {
    const h: Habit = { ...base, minQuantity: 10, minTimeMinutes: 30 };
    const onlyQty: Pick<
      DailyEntry,
      "quantity" | "startMinutes" | "endMinutes"
    > = { quantity: 10, startMinutes: null, endMinutes: null };
    expect(meetsCompletionThresholds(h, onlyQty)).toBe(false);
    const onlyTime: Pick<
      DailyEntry,
      "quantity" | "startMinutes" | "endMinutes"
    > = { quantity: null, startMinutes: 0, endMinutes: 30 };
    expect(meetsCompletionThresholds(h, onlyTime)).toBe(false);
    const both: Pick<DailyEntry, "quantity" | "startMinutes" | "endMinutes"> = {
      quantity: 10,
      startMinutes: 0,
      endMinutes: 30,
    };
    expect(meetsCompletionThresholds(h, both)).toBe(true);
  });
});
