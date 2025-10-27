import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import DayPane from "./DayPane";
import * as useData from "@/hooks/useData";

// Minimal mocks of hooks used by DayPane
vi.mock("@/hooks/useData");

describe("DayPane dialogs", () => {
  const dayKey = "2025-01-01";

  beforeEach(() => {
    vi.resetAllMocks();
    (useData.useSettings as unknown as vi.Mock).mockReturnValue({
      data: { dayStart: "00:00", showStreaks: false },
    });
    const habits = [
      {
        id: "h1",
        title: "Test Habit",
        weight: 1,
        scoreMode: "both" as const,
        createdAt: new Date().toISOString(),
      },
    ];
    const entries: any[] = [];
    (useData.useDaySummary as unknown as vi.Mock).mockReturnValue({
      byHabit: [],
      habitsQ: { data: habits },
      entriesQ: { data: entries },
      summary: { totalScore: 0, byHabit: [] },
    });
    (useData.useEntries as unknown as vi.Mock).mockReturnValue({
      upsert: { mutate: vi.fn() },
    });
    (useData.useEntriesRange as unknown as vi.Mock).mockReturnValue({
      data: [],
    });
    (useData.useHabits as unknown as vi.Mock).mockReturnValue({
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      remove: { mutateAsync: vi.fn() },
    });
  });

  it("opens and saves the Edit habit dialog", () => {
    render(
      <DayPane
        dayKey={dayKey}
        headerExpanded={false}
        sortKey="weight"
        sortDir="desc"
        filterKind="all"
        filterCompletion="all"
        filterTags={[]}
      />
    );

    // Click the Edit button
    const editButtons = screen.getAllByRole("button", { name: /edit habit/i });
    fireEvent.click(editButtons[0]);

    // Dialog title appears
    expect(screen.getByText(/edit habit/i)).toBeInTheDocument();

    // Change Quantity min and Score mode
    const qtyMin = screen.getByLabelText(/quantity min/i) as HTMLInputElement;
    fireEvent.change(qtyMin, { target: { value: "5" } });

    const save = screen.getByRole("button", { name: /save/i });
    fireEvent.click(save);

    // dialog closes
    expect(screen.queryByText(/edit habit/i)).not.toBeInTheDocument();
  });

  it("opens Log dialog, fills fields and saves", () => {
    const upsert = vi.fn();
    (useData.useEntries as unknown as vi.Mock).mockReturnValue({
      upsert: { mutate: upsert },
    });

    render(
      <DayPane
        dayKey={dayKey}
        headerExpanded={false}
        sortKey="weight"
        sortDir="desc"
        filterKind="all"
        filterCompletion="all"
        filterTags={[]}
      />
    );

    // Click Log button
    fireEvent.click(screen.getByRole("button", { name: /log/i }));

    // Fill Start, End and Quantity
    fireEvent.change(screen.getByLabelText(/start/i), {
      target: { value: "08:00" },
    });
    fireEvent.change(screen.getByLabelText(/end/i), {
      target: { value: "09:15" },
    });
    fireEvent.change(screen.getByLabelText(/quantity/i), {
      target: { value: "3" },
    });

    // Save
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(upsert).toHaveBeenCalled();
  });
});
