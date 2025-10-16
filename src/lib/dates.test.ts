import { describe, it, expect } from "vitest";
import { parseDayStart, toDayKey, isFuture } from "./dates";

describe("dates", () => {
  it("parses HH:mm correctly", () => {
    expect(parseDayStart("00:00")).toEqual([0, 0]);
    expect(parseDayStart("23:59")).toEqual([23, 59]);
    expect(parseDayStart("99:99")).toEqual([23, 59]);
    expect(parseDayStart("abc")).toEqual([0, 0]);
  });

  it("produces stable day keys with dayStart shift", () => {
    const noon = new Date("2024-01-01T12:00:00");
    expect(toDayKey(noon, "00:00")).toBe("2024-01-01");
    expect(toDayKey(noon, "16:00")).toBe("2023-12-31");
  });

  it("detects future by key", () => {
    const today = toDayKey(new Date(), "00:00");
    const future = `${today.slice(0, 8)}99`;
    expect(isFuture(future, "00:00")).toBe(true);
  });
});
