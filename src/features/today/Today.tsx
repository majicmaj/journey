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
import { contributionRaw } from "@/lib/score";
import { cn } from "@/lib/utils";
import { type Habit, type DailyEntry } from "@/types/habit";
import {
  CloseIcon,
  EditIcon,
  SaveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Day() {
  const settings = useSettings();
  const baseTodayKey = useMemo(
    () => toDayKey(new Date(), settings.data?.dayStart ?? "00:00"),
    [settings.data?.dayStart]
  );
  const [activeKey, setActiveKey] = useState<string>(baseTodayKey);
  const { habitsQ, entriesQ, summary } = useDaySummary(activeKey);
  const { upsert } = useEntries(activeKey);
  const { create, update } = useHabits();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  // Range entries for streak calculation
  const dayStart = settings.data?.dayStart ?? "00:00";
  const fromKey = useMemo(() => {
    const base = new Date(activeKey + "T00:00:00");
    const prev = new Date(base.getTime() - 365 * 24 * 60 * 60 * 1000);
    return toDayKey(prev, dayStart);
  }, [activeKey, dayStart]);
  const rangeQ = useEntriesRange(fromKey, activeKey);

  // Sorting & filtering state
  type SortKey =
    | "title"
    | "weight"
    | "createdAt"
    | "completed"
    | "value"
    | "contribution";
  const [sortKey, setSortKey] = useState<SortKey>("weight");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterKind, setFilterKind] = useState<
    "all" | "boolean" | "quantified"
  >("all");
  const [filterCompletion, setFilterCompletion] = useState<
    "all" | "completed" | "incomplete"
  >("all");

  const processed = useMemo(() => {
    const habits = habitsQ.data ?? [];
    const entries = entriesQ.data ?? [];
    const entryByHabitId = new Map(entries.map((e) => [e.habitId, e]));
    const summaryByHabitId = new Map(
      (summary?.byHabit ?? []).map((s) => [s.habitId, s])
    );

    type Row = {
      habit: Habit;
      entry?: { completed?: boolean; value?: number | null } | undefined;
      completed: boolean;
      value: number | null;
      contribution: number;
    };

    let rows: Row[] = habits.map((h) => {
      const entry = entryByHabitId.get(h.id);
      const s = summaryByHabitId.get(h.id);
      return {
        habit: h,
        entry,
        completed: s?.completed ?? entry?.completed ?? false,
        value: entry?.value ?? null,
        contribution: s?.contribution ?? 0,
      };
    });

    // Filter
    if (filterKind !== "all") {
      rows = rows.filter((r) => r.habit.kind === filterKind);
    }
    if (filterCompletion !== "all") {
      rows = rows.filter((r) =>
        filterCompletion === "completed" ? r.completed : !r.completed
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
            const av = a.value ?? -Infinity;
            const bv = b.value ?? -Infinity;
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
    filterKind,
    filterCompletion,
  ]);

  const streakByHabitId = useMemo(() => {
    if (!settings.data?.showStreaks) return new Map<string, number>();
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
    const active = new Date(activeKey + "T00:00:00");
    for (const h of habits) {
      let streak = 0;
      // Count backwards starting at activeKey
      for (let i = 0; i < 366; i++) {
        const d = new Date(active.getTime() - i * 24 * 60 * 60 * 1000);
        const key = toDayKey(d, dayStart);
        if (key < fromKey) break;
        const e: DailyEntry | undefined = entriesByHabit.get(h.id)?.get(key);
        const raw = contributionRaw(e, h);
        const done = raw >= 1;
        if (done) streak += 1;
        else break;
      }
      out.set(h.id, streak);
    }
    return out;
  }, [
    settings.data?.showStreaks,
    habitsQ.data,
    rangeQ.data,
    activeKey,
    dayStart,
    fromKey,
  ]);

  // Cold streak: consecutive days up to activeKey where habit was NOT done
  const coldStreakByHabitId = useMemo(() => {
    if (!settings.data?.showStreaks) return new Map<string, number>();
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
    const active = new Date(activeKey + "T00:00:00");
    for (const h of habits) {
      let streak = 0;
      for (let i = 0; i < 366; i++) {
        const d = new Date(active.getTime() - i * 24 * 60 * 60 * 1000);
        const key = toDayKey(d, dayStart);
        if (key < fromKey) break;
        const e: DailyEntry | undefined = entriesByHabit.get(h.id)?.get(key);
        const raw = contributionRaw(e, h);
        const done = raw >= 1;
        if (!done) streak += 1;
        else break;
      }
      out.set(h.id, streak);
    }
    return out;
  }, [
    settings.data?.showStreaks,
    habitsQ.data,
    rangeQ.data,
    activeKey,
    dayStart,
    fromKey,
  ]);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 transition-all mt-0 duration-300",
        !headerExpanded && "-mt-3"
      )}
    >
      <header
        className={cn(
          "h-0 transition-all duration-300 overflow-hidden",
          // "border overflow-hidden flex items-center justify-between flex-col sm:flex-row gap-3 flex-wrap",
          headerExpanded && "h-50"
        )}
      >
        <div className="m-1 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-1 w-full sm:w-auto sm:flex-0">
            <Button
              aria-label="Previous day"
              size="icon"
              onClick={() =>
                setActiveKey(
                  toDayKey(
                    new Date(
                      new Date(activeKey + "T00:00:00").getTime() -
                        24 * 60 * 60 * 1000
                    ),
                    settings.data?.dayStart ?? "00:00"
                  )
                )
              }
            >
              <ChevronLeftIcon className="size-8" />
            </Button>
            <div className="pixel-frame bg-card flex-1">
              <Input
                aria-label="Select date"
                type="date"
                className="w-full bg-card px-2 py-1 text-foreground"
                value={activeKey}
                onChange={(e) =>
                  setActiveKey(
                    toDayKey(e.target.value, settings.data?.dayStart ?? "00:00")
                  )
                }
              />
            </div>
            <Button
              aria-label="Next day"
              size="icon"
              onClick={() =>
                setActiveKey(
                  toDayKey(
                    new Date(
                      new Date(activeKey + "T00:00:00").getTime() +
                        24 * 60 * 60 * 1000
                    ),
                    settings.data?.dayStart ?? "00:00"
                  )
                )
              }
              disabled={activeKey >= baseTodayKey}
            >
              <ChevronRightIcon className="size-8" />
            </Button>
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => setActiveKey(baseTodayKey)}
            aria-label="Go to today"
            disabled={activeKey === baseTodayKey}
          >
            Today
          </Button>
          <div className="grid grid-cols-2 mt-2 w-full sm:flex items-center gap-3 flex-wrap">
            <div className="pixel-frame">
              <Select
                value={sortKey}
                onValueChange={(v: SortKey) => setSortKey(v)}
              >
                <SelectTrigger className="w-full sm:w-36 bg-card">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="pixel-frame">
                  <SelectItem value="weight">Sort: Weight</SelectItem>
                  <SelectItem value="title">Sort: Title</SelectItem>
                  <SelectItem value="createdAt">Sort: Created</SelectItem>
                  <SelectItem value="completed">Sort: Completed</SelectItem>
                  <SelectItem value="value">Sort: Value</SelectItem>
                  <SelectItem value="contribution">
                    Sort: Contribution
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pixel-frame">
              <Select
                value={sortDir}
                onValueChange={(v: "asc" | "desc") => setSortDir(v)}
              >
                <SelectTrigger className="w-full sm:w-28 bg-card">
                  <SelectValue placeholder="Order" />
                </SelectTrigger>
                <SelectContent className="pixel-frame">
                  <SelectItem value="asc">Asc</SelectItem>
                  <SelectItem value="desc">Desc</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pixel-frame">
              <Select
                value={filterKind}
                onValueChange={(v: "all" | "boolean" | "quantified") =>
                  setFilterKind(v)
                }
              >
                <SelectTrigger className="w-full sm:w-36 bg-card">
                  <SelectValue placeholder="Kind" />
                </SelectTrigger>
                <SelectContent className="pixel-frame">
                  <SelectItem value="all">All kinds</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="quantified">Quantified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pixel-frame">
              <Select
                value={filterCompletion}
                onValueChange={(v: "all" | "completed" | "incomplete") =>
                  setFilterCompletion(v)
                }
              >
                <SelectTrigger className="w-full sm:w-40 bg-card">
                  <SelectValue placeholder="Completion" />
                </SelectTrigger>
                <SelectContent className="pixel-frame">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="incomplete">Incomplete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      <Button
        variant={headerExpanded ? "secondary" : "ghost"}
        className="w-full"
        size="icon"
        onClick={() => setHeaderExpanded((prev) => !prev)}
      >
        {headerExpanded ? (
          <ChevronUpIcon className="size-8" />
        ) : (
          <ChevronDownIcon className="size-8" />
        )}
      </Button>
      <Progress
        className="w-full my-2 sm:w-64 p"
        value={summary?.totalScore ?? 0}
      />

      <section className="flex flex-col gap-3">
        {processed.map(({ habit: h, entry }) => {
          return (
            <HabitRow
              key={h.id}
              habit={h}
              entry={entry}
              streak={streakByHabitId.get(h.id) ?? 0}
              coldStreak={coldStreakByHabitId.get(h.id) ?? 0}
              inlineValueInput={settings.data?.inlineValueInput ?? true}
              onToggle={() => {
                const nextCompleted = !(entry?.completed ?? false);
                if (h.kind === "quantified" && nextCompleted) {
                  const threshold =
                    h.target != null ? h.target : h.min != null ? h.min : 0;
                  const currentValue = entry?.value ?? 0;
                  const nextValue = Math.max(currentValue, threshold ?? 0);
                  upsert.mutate({
                    habitId: h.id,
                    date: activeKey,
                    completed: nextCompleted,
                    value: nextValue,
                  });
                } else {
                  upsert.mutate({
                    habitId: h.id,
                    date: activeKey,
                    completed: nextCompleted,
                  });
                }
              }}
              onSetValue={(v) =>
                upsert.mutate({
                  habitId: h.id,
                  date: activeKey,
                  value: v,
                  completed: entry?.completed ?? false,
                })
              }
              onEdit={() => setEditingId(editingId === h.id ? null : h.id)}
              isEditing={editingId === h.id}
              onSaveHabit={(next) => {
                update.mutate(next);
                setEditingId(null);
              }}
              onCancelEdit={() => setEditingId(null)}
            />
          );
        })}
      </section>

      <div className="border-2 border-border w-full h-px my-2" />

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
              kind: "boolean",
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

function HabitRow({
  habit,
  entry,
  streak,
  coldStreak,
  inlineValueInput,
  onToggle,
  onSetValue,
  onEdit,
  isEditing,
  onSaveHabit,
  onCancelEdit,
}: {
  habit: Habit;
  entry: { completed?: boolean; value?: number | null } | undefined;
  streak?: number;
  coldStreak?: number;
  inlineValueInput: boolean;
  onToggle: () => void;
  onSetValue: (v: number | null) => void;
  onEdit: () => void;
  isEditing: boolean;
  onSaveHabit: (next: Habit) => void;
  onCancelEdit: () => void;
}) {
  return (
    <PixelCard className="flex flex-col gap-2">
      <div className="flex items-start pt-1 justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            aria-label={entry?.completed ? "Mark incomplete" : "Mark complete"}
            size="icon"
            variant={entry?.completed ? "secondary" : "background"}
            onClick={onToggle}
          >
            {entry?.completed && (
              <CheckIcon className="text-foreground size-8" />
            )}
          </Button>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                !isEditing ? "text-lg line-clamp-1" : "line-clamp-5"
              )}
            >
              {habit.title}
            </span>
            {typeof streak !== "undefined" && streak > 0 ? (
              <span className="text-xs text-muted-foreground">{streak}d</span>
            ) : typeof coldStreak !== "undefined" && coldStreak > 0 ? (
              <span className="text-xs text-destructive">-{coldStreak}d</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-end gap-3">
          {habit.kind === "quantified" && inlineValueInput && (
            <div className="relative w-32 pixel-frame">
              <>
                <Input
                  aria-label={`value-${habit.id}`}
                  className="w-32 pr-12 bg-background"
                  type="number"
                  defaultValue={entry?.value ?? ""}
                  onBlur={(ev) => {
                    const raw = ev.currentTarget.value.trim();
                    onSetValue(raw === "" ? null : Number(raw));
                  }}
                />
                <div className="pointer-events-none absolute right-2 bottom-1 text-xs text-muted-foreground max-w-16 truncate">
                  {habit.unit ?? ""}
                </div>
              </>
            </div>
          )}
          <Button aria-label="Edit habit" onClick={onEdit} size="icon">
            {isEditing ? (
              <CloseIcon className="size-8" />
            ) : (
              <EditIcon className="size-8" />
            )}
          </Button>
        </div>
      </div>

      {isEditing ? (
        <HabitEditorInline
          habit={habit}
          onSave={onSaveHabit}
          onCancel={onCancelEdit}
        />
      ) : null}
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
  return (
    <div className="mt-1 grid gap-3 grid-cols-1 sm:grid-cols-2">
      <label className="flex items-center gap-2 col-span-full sm:col-span-2">
        <span className="w-24 text-sm">Title</span>
        <Input
          value={draft.title}
          className="bg-background"
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="w-24 text-sm">Kind</span>
        <div className="pixel-frame w-full">
          <Select
            value={draft.kind}
            onValueChange={(value) =>
              setDraft({ ...draft, kind: value as Habit["kind"] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="pixel-frame">
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="quantified">Quantified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </label>
      <label className="flex items-center gap-2">
        <span
          className={cn(
            "w-24 text-sm",
            draft.kind === "boolean" && "opacity-50"
          )}
        >
          Unit
        </span>
        <Input
          value={draft.unit ?? ""}
          className="bg-background"
          disabled={draft.kind === "boolean"}
          onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2">
        <span
          className={cn(
            "w-24 text-sm",
            draft.kind === "boolean" && "opacity-50"
          )}
        >
          Target
        </span>
        <Input
          type="number"
          className="bg-background"
          value={draft.target ?? ""}
          disabled={draft.kind === "boolean"}
          onChange={(e) => {
            const v = e.target.value;
            setDraft({ ...draft, target: v === "" ? null : Number(v) });
          }}
        />
      </label>
      <label className="flex items-center gap-2">
        <span
          className={cn(
            "w-24 text-sm",
            draft.kind === "boolean" && "opacity-50"
          )}
        >
          Min
        </span>
        <Input
          type="number"
          className="bg-background"
          value={draft.min ?? ""}
          disabled={draft.kind === "boolean"}
          onChange={(e) => {
            const v = e.target.value;
            setDraft({ ...draft, min: v === "" ? null : Number(v) });
          }}
        />
      </label>
      <label className="flex items-center gap-2">
        <span
          className={cn(
            "w-24 text-sm",
            draft.kind === "boolean" && "opacity-50"
          )}
        >
          Max
        </span>
        <Input
          type="number"
          className="bg-background"
          value={draft.max ?? ""}
          disabled={draft.kind === "boolean"}
          onChange={(e) => {
            const v = e.target.value;
            setDraft({ ...draft, max: v === "" ? null : Number(v) });
          }}
        />
      </label>

      <label className="flex items-center gap-2">
        <span className="w-24 text-sm">Weight</span>
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
          <Button onClick={() => onSave(draft)} size="icon">
            <SaveIcon className="size-8" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Progress({ className, value }: { className: string; value: number }) {
  return (
    <div
      className={cn("pixel-frame bg-card h-6 w-64 relative", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div
        className="bg-secondary h-full transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
      <div className="absolute inset-0 grid grid-cols-10">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="border-r-4 border-border" />
        ))}
      </div>
    </div>
  );
}
