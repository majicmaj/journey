import { useMemo, useState } from "react";
import { PixelCard } from "@/components/pixel";
import {
  useDaySummary,
  useEntries,
  useHabits,
  useSettings,
  useEntriesRange,
} from "@/hooks/useData";
import { toDayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { type Habit, type DailyEntry } from "@/types/habit";
import {
  EditIcon,
  SaveIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  IceIcon,
  FireIcon,
} from "@/components/pixel/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { meetsCompletionThresholds } from "./logic";
import type { DaySortKey } from "./Today";

function DayPane({
  dayKey,
  headerExpanded,
  sortKey,
  sortDir,
  filterCompletion,
  filterTags,
}: {
  dayKey: string;
  headerExpanded: boolean;
  sortKey: DaySortKey;
  sortDir: "asc" | "desc";
  filterCompletion: "all" | "completed" | "incomplete";
  filterTags: string[];
}) {
  const settings = useSettings();
  const pixelFrameEnabled = settings.data?.pixelFrameEnabled ?? false;
  const { habitsQ, entriesQ, summary } = useDaySummary(dayKey);
  const { upsert } = useEntries(dayKey);
  const { create, update } = useHabits();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  // Range entries for streak calculation
  const dayStart = settings.data?.dayStart ?? "00:00";
  const fromKey = useMemo(() => {
    const base = new Date(dayKey + "T00:00:00");
    const prev = new Date(base.getTime() - 365 * 24 * 60 * 60 * 1000);
    return toDayKey(prev, dayStart);
  }, [dayKey, dayStart]);
  const rangeQ = useEntriesRange(fromKey, dayKey);

  // Sorting and filtering are controlled by parent (Today.tsx)

  // Inline helper logic moved to features/today/logic for unified model
  // Kept here only for local computations via imports when needed.

  const processed = useMemo(() => {
    const habits = habitsQ.data ?? [];
    const entries = entriesQ.data ?? [];
    const entryByHabitId = new Map(entries.map((e) => [e.habitId, e]));
    const summaryByHabitId = new Map(
      (summary?.byHabit ?? []).map((s) => [s.habitId, s])
    );

    type Row = {
      habit: Habit;
      entry?: DailyEntry | undefined;
      completed: boolean;
      value: number | boolean | null;
      contribution: number;
    };

    let rows: Row[] = habits.map((h) => {
      const entry = entryByHabitId.get(h.id);
      const s = summaryByHabitId.get(h.id);
      return {
        habit: h,
        entry,
        completed: s?.completed ?? entry?.completed ?? false,
        value: s?.value ?? entry?.value ?? null,
        contribution: s?.contribution ?? 0,
      };
    });

    // Filter
    // Kind filter removed in unified model
    if (filterCompletion !== "all") {
      rows = rows.filter((r) =>
        filterCompletion === "completed" ? r.completed : !r.completed
      );
    }

    // Filter by tags if provided (match any of the selected tags)
    if (filterTags && filterTags.length > 0) {
      rows = rows.filter((r) =>
        (r.habit.tags ?? []).some((t) => filterTags.includes(t))
      );
    }

    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const by = ((): number => {
        switch (sortKey) {
          case "title":
            return a.habit.title.localeCompare(b.habit.title);
          case "weight":
            return a.habit.weight === b.habit.weight
              ? a.habit.title.localeCompare(b.habit.title)
              : a.habit.weight < b.habit.weight
              ? -1
              : 1;
          case "createdAt":
            return a.habit.createdAt < b.habit.createdAt ? -1 : 1;
          case "completed":
            return Number(a.completed) === Number(b.completed)
              ? a.habit.title.localeCompare(b.habit.title)
              : Number(a.completed) < Number(b.completed)
              ? -1
              : 1;
          case "value": {
            const av = typeof a.value === "number" ? a.value : -Infinity;
            const bv = typeof b.value === "number" ? b.value : -Infinity;
            return av === bv
              ? a.habit.title.localeCompare(b.habit.title)
              : av < bv
              ? -1
              : 1;
          }
          case "contribution":
            return a.contribution === b.contribution
              ? a.habit.title.localeCompare(b.habit.title)
              : a.contribution < b.contribution
              ? -1
              : 1;
          case "tag": {
            const at = (a.habit.tags ?? []).join(",");
            const bt = (b.habit.tags ?? []).join(",");
            return at === bt
              ? a.habit.title.localeCompare(b.habit.title)
              : at.localeCompare(bt);
          }
          default:
            return 0;
        }
      })();
      return by * dir;
    });

    return rows;
  }, [
    habitsQ.data,
    entriesQ.data,
    summary,
    sortKey,
    sortDir,
    filterCompletion,
    filterTags,
  ]);

  const streakByHabitId = useMemo(() => {
    const habits = habitsQ.data ?? [];
    const all = rangeQ.data ?? [];
    // Build map: habitId -> dateKey -> entry
    const entriesByHabit = new Map<string, Map<string, DailyEntry>>();
    for (const e of all) {
      const m: Map<string, DailyEntry> =
        entriesByHabit.get(e.habitId) ?? new Map();
      m.set(e.date, e);
      entriesByHabit.set(e.habitId, m);
    }
    const out = new Map<string, number>();
    const active = new Date(dayKey + "T00:00:00");
    for (const h of habits) {
      let streak = 0;
      // Determine whether the active day is completed; if not, start from yesterday
      const todayEntry: DailyEntry | undefined = entriesByHabit
        .get(h.id)
        ?.get(dayKey);
      const todayDone = Boolean(todayEntry?.completed);
      const startOffset = todayDone ? 0 : 1;
      // Count backwards starting at dayKey (including today only if done)
      for (let i = startOffset; i < 366; i++) {
        const d = new Date(active.getTime() - i * 24 * 60 * 60 * 1000);
        const key = toDayKey(d, dayStart);
        if (key < fromKey) break;
        const e: DailyEntry | undefined = entriesByHabit.get(h.id)?.get(key);
        const done = Boolean(e?.completed);
        if (done) streak += 1;
        else break;
      }
      out.set(h.id, streak);
    }
    return out;
  }, [habitsQ.data, rangeQ.data, dayKey, dayStart, fromKey]);

  const doneEverByHabitId = useMemo(() => {
    const habits = habitsQ.data ?? [];
    const all = rangeQ.data ?? [];
    const entriesByHabit = new Map<string, DailyEntry[]>();
    for (const e of all) {
      const arr = entriesByHabit.get(e.habitId) ?? [];
      arr.push(e);
      entriesByHabit.set(e.habitId, arr);
    }
    const out = new Map<string, boolean>();
    for (const h of habits) {
      const arr = entriesByHabit.get(h.id) ?? [];
      const anyDone = arr.some((e) => Boolean(e.completed));
      out.set(h.id, anyDone);
    }
    return out;
  }, [habitsQ.data, rangeQ.data]);

  const coldStreakByHabitId = useMemo(() => {
    const habits = habitsQ.data ?? [];
    const all = rangeQ.data ?? [];
    const entriesByHabit = new Map<string, Map<string, DailyEntry>>();
    for (const e of all) {
      const m: Map<string, DailyEntry> =
        entriesByHabit.get(e.habitId) ?? new Map();
      m.set(e.date, e);
      entriesByHabit.set(e.habitId, m);
    }
    const out = new Map<string, number>();
    const active = new Date(dayKey + "T00:00:00");
    for (const h of habits) {
      let streak = 0;
      for (let i = 0; i < 366; i++) {
        const d = new Date(active.getTime() - i * 24 * 60 * 60 * 1000);
        const key = toDayKey(d, dayStart);
        if (key < fromKey) break;
        const e: DailyEntry | undefined = entriesByHabit.get(h.id)?.get(key);
        const done = Boolean(e?.completed);
        if (!done) streak += 1;
        else break;
      }
      out.set(h.id, streak - 1);
    }
    return out;
  }, [habitsQ.data, rangeQ.data, dayKey, dayStart, fromKey]);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 transition-all mt-0 duration-300 pb-3",
        !headerExpanded && "-mt-3"
      )}
    >
      <section className="flex flex-col gap-3">
        {processed.map(({ habit: h, entry }) => {
          return (
            <HabitRow
              key={`${h.id}-${dayKey}`}
              habit={h}
              entry={entry}
              streak={streakByHabitId.get(h.id) ?? 0}
              coldStreak={coldStreakByHabitId.get(h.id) ?? 0}
              isNew={doneEverByHabitId.get(h.id) === false}
              onToggle={() => {
                const nextCompleted = !(entry?.completed ?? false);
                // Preserve any existing logged fields when toggling completion
                upsert.mutate({
                  habitId: h.id,
                  date: dayKey,
                  completed: nextCompleted,
                  quantity:
                    typeof entry?.quantity === "number" ? entry.quantity : null,
                  startMinutes:
                    typeof entry?.startMinutes === "number"
                      ? entry.startMinutes
                      : null,
                  endMinutes:
                    typeof entry?.endMinutes === "number"
                      ? entry.endMinutes
                      : null,
                });
              }}
              onLog={() => setLoggingId(h.id)}
              onEdit={() => setEditingId(h.id)}
            />
          );
        })}
      </section>

      {/* Edit dialog */}
      {editingId ? (
        <Dialog open={true} onOpenChange={(o) => !o && setEditingId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit habit</DialogTitle>
            </DialogHeader>
            {(() => {
              const h = (habitsQ.data ?? []).find((x) => x.id === editingId);
              return h ? (
                <HabitEditorInline
                  habit={h}
                  onSave={(next) => {
                    update.mutate(next);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : null;
            })()}
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Log dialog */}
      {loggingId ? (
        <Dialog open={true} onOpenChange={(o) => !o && setLoggingId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log entry</DialogTitle>
              <DialogDescription>
                Add time and quantity for this habit
              </DialogDescription>
            </DialogHeader>
            {(() => {
              const h = (habitsQ.data ?? []).find((x) => x.id === loggingId);
              const e = (entriesQ.data ?? []).find(
                (x) => x.habitId === loggingId
              );
              if (!h) return null;
              return (
                <LogDialogInner
                  habit={h}
                  entry={e}
                  onConfirm={(payload) => {
                    const completed = meetsCompletionThresholds(
                      h,
                      payload as any
                    );
                    upsert.mutate({
                      habitId: h.id,
                      date: dayKey,
                      completed,
                      logs: payload.logs.map((l) => ({
                        id: crypto.randomUUID(),
                        quantity: l.quantity,
                        startMinutes: l.startMinutes,
                        endMinutes: l.endMinutes,
                        editedAt: new Date().toISOString(),
                      })),
                    });
                    setLoggingId(null);
                  }}
                />
              );
            })()}
          </DialogContent>
        </Dialog>
      ) : null}

      <div
        className="border rounded-md border-border w-full h-px my-2"
        style={{
          borderTopWidth: pixelFrameEnabled
            ? "max(var(--pixel-frame-size), 1px)"
            : "1px",
        }}
      />

      <footer className="flex gap-3">
        <div className="pixel-frame flex-1">
          <Input
            aria-label="New habit"
            placeholder="New habit..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 bg-card"
          />
        </div>
        <Button
          onClick={() => {
            const t = title.trim();
            if (!t) return;
            const habit: Habit = {
              id: crypto.randomUUID(),
              title: t,
              weight: 1,
              scoreMode: "both",
              createdAt: new Date().toISOString(),
            };
            create.mutate(habit);
            setTitle("");
          }}
          size="icon"
        >
          <PlusIcon className="size-8" />
        </Button>
      </footer>
    </div>
  );
}
export default DayPane;

function LogDialogInner({
  habit,
  entry,
  onConfirm,
}: {
  habit: Habit;
  entry: DailyEntry | undefined;
  onConfirm: (payload: {
    logs: Array<{
      quantity: number | null;
      startMinutes: number | null;
      endMinutes: number | null;
    }>;
  }) => void;
}) {
  const toTime = (m: number | null | undefined) =>
    typeof m === "number"
      ? `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(
          m % 60
        ).padStart(2, "0")}`
      : "";
  type LogRow = { id: string; start: string; end: string; quantity: string };
  const initialLogs: LogRow[] = (() => {
    const logs = entry?.logs ?? [];
    if (logs.length > 0)
      return logs.map((l) => ({
        id: l.id,
        start: toTime(l.startMinutes ?? null),
        end: toTime(l.endMinutes ?? null),
        quantity: typeof l.quantity === "number" ? String(l.quantity) : "",
      }));
    return [
      {
        id: crypto.randomUUID(),
        start: toTime(entry?.startMinutes ?? null),
        end: toTime(entry?.endMinutes ?? null),
        quantity:
          typeof entry?.quantity === "number" ? String(entry.quantity) : "",
      },
    ];
  })();
  const [rows, setRows] = useState<LogRow[]>(initialLogs);
  const [selectedId, setSelectedId] = useState<string>(
    initialLogs[0]?.id ?? ""
  );

  const parseTime = (s: string): number | null => {
    const m = s.match(/^\d{1,2}:\d{2}$/);
    if (!m) return null;
    const [hh, mm] = s.split(":").map((x) => Number(x));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return hh * 60 + mm;
  };

  const totalDuration = rows.reduce((sum, row) => {
    const s = parseTime(row.start);
    const e = parseTime(row.end);
    if (s == null || e == null) return sum;
    return sum + Math.max(e - s, 0);
  }, 0);
  const totalHH = Math.floor(totalDuration / 60);
  const totalMM = totalDuration % 60;

  return (
    <div className="grid gap-3">
      {/* Log list as buttons */}
      <div className="pixel-frame">
        <div className="flex flex-col p-3 gap-2 overflow-y-auto overflow-x-hidden max-h-96">
          {rows.map((row, i) => {
            const s = parseTime(row.start);
            const e = parseTime(row.end);
            const d = s != null && e != null ? Math.max(e - s, 0) : null;
            const label = `${row.start || "--:--"}-${row.end || "--:--"}${
              d != null ? ` (${Math.floor(d / 60)}h ${d % 60}m)` : ""
            }${
              row.quantity
                ? ` • ${row.quantity}${habit.quantityUnit ?? ""}`
                : ""
            }`;
            return (
              <div
                key={row.id}
                className={cn(
                  "pixel-frame p-2 pl-3",
                  selectedId === row.id ? "bg-secondary" : "bg-background"
                )}
                role="button"
                onClick={() => setSelectedId(row.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{`${i + 1}: ${label}`}</span>
                  <Button
                    size="icon-sm"
                    variant="destructive"
                    aria-label="Delete log"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setRows((prev) => {
                        const next = prev.filter((r) => r.id !== row.id);
                        if (next.length === 0) {
                          const newRow = {
                            id: crypto.randomUUID(),
                            start: "",
                            end: "",
                            quantity: "",
                          } as const;
                          setSelectedId(newRow.id);
                          return [newRow];
                        }
                        if (selectedId === row.id) {
                          const idx = prev.findIndex((r) => r.id === row.id);
                          const fallback =
                            next[Math.max(0, Math.min(idx, next.length - 1))];
                          setSelectedId(fallback.id);
                        }
                        return next;
                      });
                    }}
                  >
                    <TrashIcon className="size-6" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Button
        variant="outline"
        onClick={() => {
          const newRow: LogRow = {
            id: crypto.randomUUID(),
            start: "",
            end: "",
            quantity: "",
          };
          setRows((r) => [...r, newRow]);
          setSelectedId(newRow.id);
        }}
      >
        Add a new log
      </Button>

      {/* Summary */}
      <div className="text-sm opacity-80">
        Total: {totalHH}h {totalMM}m • {rows.length} log
        {rows.length === 1 ? "" : "s"}
      </div>

      {/* Editor for selected */}
      {(() => {
        const row = rows.find((r) => r.id === selectedId) ?? rows[0];
        if (!row) return null;
        return (
          <div key={row.id} className="grid gap-3">
            <div className="flex items-center gap-3">
              <span className="w-28 text-sm">Start</span>
              <div className="pixel-frame w-full">
                <Input
                  type="time"
                  className="bg-background"
                  value={row.start}
                  onChange={(ev) =>
                    setRows((r) =>
                      r.map((x) =>
                        x.id === row.id ? { ...x, start: ev.target.value } : x
                      )
                    )
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-28 text-sm">End</span>
              <div className="pixel-frame w-full">
                <Input
                  type="time"
                  className="bg-background"
                  value={row.end}
                  onChange={(ev) =>
                    setRows((r) =>
                      r.map((x) =>
                        x.id === row.id ? { ...x, end: ev.target.value } : x
                      )
                    )
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-28 text-sm">Quantity</span>
              <div className="pixel-frame w-full relative">
                <Input
                  type="number"
                  className="bg-background pr-14"
                  value={row.quantity}
                  onChange={(ev) =>
                    setRows((r) =>
                      r.map((x) =>
                        x.id === row.id
                          ? { ...x, quantity: ev.target.value }
                          : x
                      )
                    )
                  }
                />
                <div className="pointer-events-none absolute right-2 bottom-1 text-xs text-muted-foreground max-w-16 truncate">
                  {habit.quantityUnit ?? ""}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      <DialogFooter>
        <Button
          onClick={() => {
            const logs = rows.map((r) => ({
              quantity: r.quantity.trim() === "" ? null : Number(r.quantity),
              startMinutes: parseTime(r.start),
              endMinutes: parseTime(r.end),
            }));
            onConfirm({ logs });
          }}
        >
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

function HabitRow({
  habit,
  entry,
  streak,
  coldStreak,
  isNew,
  onToggle,
  onLog,
  onEdit,
}: {
  habit: Habit;
  entry: DailyEntry | undefined;
  streak?: number;
  coldStreak?: number;
  isNew?: boolean;
  onToggle: () => void;
  onLog: () => void;
  onEdit: () => void;
}) {
  return (
    <PixelCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            aria-label={entry?.completed ? "Mark incomplete" : "Mark complete"}
            size="icon-sm"
            variant={entry?.completed ? "secondary" : "background"}
            onClick={onToggle}
          >
            {entry?.completed && (
              <CheckIcon className="text-secondary-foreground size-8" />
            )}
          </Button>
          <div className="flex flex-col">
            <span className={cn("text-sm line-clamp-1")}>{habit.title}</span>
            <div>
              {typeof streak !== "undefined" && streak > 0 ? (
                <div className="flex items-center gap-1 text-chart-1">
                  <FireIcon className="size-4" />
                  <span className="text-xs">{streak}d</span>
                </div>
              ) : isNew ? (
                <span className="text-xs text-primary"> 0d</span>
              ) : typeof coldStreak !== "undefined" && coldStreak > 0 ? (
                <div className="flex items-center gap-1 text-chart-2">
                  <IceIcon className="size-4" />
                  <span className={"text-xs"}>-{coldStreak}d</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <Button
            size="sm"
            variant={entry ? "outline" : "default"}
            aria-label={entry ? "Update log" : "Log"}
            onClick={onLog}
          >
            LOG
          </Button>
          <Button aria-label="Edit habit" onClick={onEdit} size="icon-sm">
            <EditIcon className="size-6" />
          </Button>
        </div>
      </div>
    </PixelCard>
  );
}

function HabitEditorInline({
  habit,
  onSave,
  onCancel,
}: {
  habit: Habit;
  onSave: (h: Habit) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Habit>({ ...habit });
  const [weightInput, setWeightInput] = useState<string>(String(habit.weight));
  const { remove } = useHabits();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // removed kind change flow in unified model
  return (
    <div className="mt-1 grid gap-3 grid-cols-1 sm:grid-cols-2">
      <label className="flex items-center gap-3 col-span-full sm:col-span-2">
        <span className="w-24 sm:w-19 text-sm">Title</span>
        <div className="pixel-frame w-full">
          <Input
            value={draft.title}
            className="bg-background"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
      </label>
      <label className="flex items-start gap-3 col-span-full sm:col-span-2">
        <span className="w-24 sm:w-19 text-sm mt-1">Tags</span>
        <div className="flex flex-col gap-3 w-full">
          <MultiSelect
            modal={true}
            options={Array.from(
              new Set(
                (useHabits().data ?? [])
                  .flatMap((h) => h.tags ?? [])
                  .concat(draft.tags ?? [])
              )
            )
              .sort()
              .map((t) => ({ value: t, label: t }))}
            value={(draft.tags ?? []) as string[]}
            onChange={(next) => setDraft({ ...draft, tags: next })}
            placeholder="Select tags"
            triggerClassName="bg-background"
            contentClassName="bg-background"
            creatable={true}
            createPlaceholder="Add new tag"
            onCreate={(input) => input as string}
          />
        </div>
      </label>
      <label className="flex items-center gap-3">
        <span className="w-24 text-sm">Quantity min</span>
        <div className="pixel-frame w-full">
          <Input
            type="number"
            className="bg-background"
            value={draft.minQuantity ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setDraft({ ...draft, minQuantity: v === "" ? null : Number(v) });
            }}
          />
        </div>
      </label>
      <label className="flex items-center gap-3">
        <span className="w-24 text-sm">Quantity max</span>
        <div className="pixel-frame w-full">
          <Input
            type="number"
            className="bg-background"
            value={draft.maxQuantity ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setDraft({ ...draft, maxQuantity: v === "" ? null : Number(v) });
            }}
          />
        </div>
      </label>
      <label className="flex items-center gap-3">
        <span className="w-24 text-sm">Min daily duration</span>
        <div className="pixel-frame w-full">
          <Input
            type="time"
            className="bg-background"
            value={
              typeof draft.minTimeMinutes === "number"
                ? `${String(Math.floor(draft.minTimeMinutes / 60)).padStart(
                    2,
                    "0"
                  )}:${String(draft.minTimeMinutes % 60).padStart(2, "0")}`
                : ""
            }
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") setDraft({ ...draft, minTimeMinutes: null });
              else {
                const [hh, mm] = raw.split(":").map((s) => Number(s));
                const minutes =
                  (Number.isFinite(hh) ? hh : 0) * 60 +
                  (Number.isFinite(mm) ? mm : 0);
                setDraft({ ...draft, minTimeMinutes: minutes });
              }
            }}
          />
        </div>
      </label>
      <label className="flex items-center gap-3">
        <span className="w-24 text-sm">Max daily duration</span>
        <div className="pixel-frame w-full">
          <Input
            type="time"
            className="bg-background"
            value={
              typeof draft.maxTimeMinutes === "number"
                ? `${String(Math.floor(draft.maxTimeMinutes / 60)).padStart(
                    2,
                    "0"
                  )}:${String(draft.maxTimeMinutes % 60).padStart(2, "0")}`
                : ""
            }
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") setDraft({ ...draft, maxTimeMinutes: null });
              else {
                const [hh, mm] = raw.split(":").map((s) => Number(s));
                const minutes =
                  (Number.isFinite(hh) ? hh : 0) * 60 +
                  (Number.isFinite(mm) ? mm : 0);
                setDraft({ ...draft, maxTimeMinutes: minutes });
              }
            }}
          />
        </div>
      </label>
      <label className="flex items-center gap-3">
        <span className="w-24 text-sm">Score mode</span>
        <div className="pixel-frame w-full">
          <Select
            value={(draft.scoreMode ?? "both") as string}
            onValueChange={(value) =>
              setDraft({ ...draft, scoreMode: value as Habit["scoreMode"] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="pixel-frame">
              <SelectItem value="quantity">Quantity</SelectItem>
              <SelectItem value="time">Time</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </label>

      <label className="flex items-center gap-3">
        <span className="w-24 text-sm">Weight</span>
        <div className="pixel-frame w-full">
          <Input
            type="number"
            className="bg-background"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            onBlur={(e) => {
              const raw = e.currentTarget.value.trim();
              const parsed = raw === "" ? 0 : Number(raw);
              setWeightInput(String(parsed));
              setDraft({
                ...draft,
                weight: Number.isFinite(parsed) ? parsed : 0,
              });
            }}
          />
        </div>
      </label>

      <label className="flex items-center gap-3">
        <span className="w-24 text-sm">Unit</span>
        <div className="pixel-frame w-full">
          <Input
            value={draft.quantityUnit ?? ""}
            className="bg-background"
            onChange={(e) =>
              setDraft({ ...draft, quantityUnit: e.target.value })
            }
          />
        </div>
      </label>
      <div className="col-span-full flex gap-3 justify-between">
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => setConfirmOpen(true)}
            >
              <TrashIcon className="size-8" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete habit?</DialogTitle>
              <DialogDescription>
                This will permanently remove "{habit.title}" and all of its
                daily entries. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await remove.mutateAsync(habit.id);
                  setConfirmOpen(false);
                  onCancel();
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="flex items-center gap-3">
          <Button
            onClick={async () => {
              // Ensure scoreMode is set
              onSave({
                ...draft,
                scoreMode: (draft.scoreMode ?? "both") as Habit["scoreMode"],
              });
            }}
            size="icon"
          >
            <SaveIcon className="size-8" />
          </Button>
          {/* kind change dialog removed in unified model */}
        </div>
      </div>
    </div>
  );
}

// AddTagRow has been inlined into MultiSelect via creatable props.
