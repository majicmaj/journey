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
  CloseIcon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";

function DayPane({
  dayKey,
  headerExpanded,
  sortKey,
  sortDir,
  filterKind,
  filterCompletion,
}: {
  dayKey: string;
  headerExpanded: boolean;
  sortKey:
    | "title"
    | "weight"
    | "createdAt"
    | "completed"
    | "value"
    | "contribution";
  sortDir: "asc" | "desc";
  filterKind: "all" | "boolean" | "quantified" | "time";
  filterCompletion: "all" | "completed" | "incomplete";
}) {
  const settings = useSettings();
  const { habitsQ, entriesQ, summary } = useDaySummary(dayKey);
  const { upsert } = useEntries(dayKey);
  const { create, update } = useHabits();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  // Range entries for streak calculation
  const dayStart = settings.data?.dayStart ?? "00:00";
  const fromKey = useMemo(() => {
    const base = new Date(dayKey + "T00:00:00");
    const prev = new Date(base.getTime() - 365 * 24 * 60 * 60 * 1000);
    return toDayKey(prev, dayStart);
  }, [dayKey, dayStart]);
  const rangeQ = useEntriesRange(fromKey, dayKey);

  // Sorting and filtering are controlled by parent (Today.tsx)

  type Habit = {
    kind: "quantified" | "time" | string;
    min?: number | null;
    max?: number | null;
    target?: number | null;
  };

  function meetsCompletionThresholds(
    h: Habit,
    value: number | null | undefined
  ): boolean {
    if (h.kind !== "quantified" && h.kind !== "time") return false;

    // Only accept finite numbers
    const v =
      typeof value === "number" && Number.isFinite(value) ? value : null;
    if (v == null) return false;

    // If no explicit min, use target as a minimum-style goal.
    const min = h.min ?? h.target ?? null;
    const max = h.max ?? null;

    // Both bounds present -> inclusive range check.
    if (min != null && max != null) {
      // Invalid config (min > max) -> treat as not met.
      if (min > max) return false;
      return v >= min && v <= max;
    }

    if (min != null) return v >= min;
    if (max != null) return v <= max;

    // No thresholds present
    return true;
  }

  function requiresValueForCompletion(h: Habit): boolean {
    if (h.kind !== "quantified" && h.kind !== "time") return false;
    return h.min != null || h.max != null || h.target != null;
  }

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
  }, [
    settings.data?.showStreaks,
    habitsQ.data,
    rangeQ.data,
    dayKey,
    dayStart,
    fromKey,
  ]);

  const doneEverByHabitId = useMemo(() => {
    if (!settings.data?.showStreaks) return new Map<string, boolean>();
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
  }, [settings.data?.showStreaks, habitsQ.data, rangeQ.data]);

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
  }, [
    settings.data?.showStreaks,
    habitsQ.data,
    rangeQ.data,
    dayKey,
    dayStart,
    fromKey,
  ]);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 transition-all mt-0 duration-300 pb-3",
        !headerExpanded && "-mt-3"
      )}
    >
      {/* Header toggle moved to Today.tsx */}
      <Progress
        key={dayKey}
        className="w-full my-2 sm:w-64 p"
        value={summary?.totalScore ?? 0}
      />

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
              inlineValueInput={true}
              onToggle={() => {
                const nextCompleted = !(entry?.completed ?? false);
                const isInput = h.kind === "quantified" || h.kind === "time";
                if (nextCompleted && isInput) {
                  const requires = requiresValueForCompletion(h);
                  const currentValue = entry?.value ?? null;
                  if (requires) {
                    // Must have a value and meet thresholds to complete
                    if (meetsCompletionThresholds(h, currentValue)) {
                      upsert.mutate({
                        habitId: h.id,
                        date: dayKey,
                        completed: true,
                        value: currentValue,
                      });
                    }
                    // If value is missing or doesn't meet thresholds, do nothing
                    return;
                  }
                  // No thresholds: allow convenience set for time kind
                  if (h.kind === "time" && currentValue == null) {
                    const now = new Date();
                    const minutes = now.getHours() * 60 + now.getMinutes();
                    upsert.mutate({
                      habitId: h.id,
                      date: dayKey,
                      completed: true,
                      value: minutes,
                    });
                    return;
                  }
                }
                // Generic toggle path (including marking incomplete)
                upsert.mutate({
                  habitId: h.id,
                  date: dayKey,
                  completed: nextCompleted,
                });
              }}
              onSetValue={(v) => {
                const requires = requiresValueForCompletion(h);
                const shouldComplete = requires
                  ? meetsCompletionThresholds(h, v)
                  : entry?.completed ?? false;
                upsert.mutate({
                  habitId: h.id,
                  date: dayKey,
                  value: v,
                  completed: shouldComplete,
                });
              }}
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
export default DayPane;

function Progress({ className, value }: { className: string; value: number }) {
  return (
    <div
      className={cn(
        "pixel-frame rounded-md overflow-hidden bg-card h-6 w-64 relative",
        className
      )}
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

function HabitRow({
  habit,
  entry,
  streak,
  coldStreak,
  isNew,
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
  isNew?: boolean;
  inlineValueInput: boolean;
  onToggle: () => void;
  onSetValue: (v: number | null) => void;
  onEdit: () => void;
  isEditing: boolean;
  onSaveHabit: (next: Habit) => void;
  onCancelEdit: () => void;
}) {
  return (
    <PixelCard className="flex flex-col gap-3">
      <div className="flex items-start pt-1 justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            aria-label={entry?.completed ? "Mark incomplete" : "Mark complete"}
            size="icon"
            variant={entry?.completed ? "secondary" : "background"}
            onClick={onToggle}
          >
            {entry?.completed && (
              <CheckIcon className="text-secondary-foreground size-8" />
            )}
          </Button>
          <div className="flex flex-col">
            <span
              className={cn(
                !isEditing ? "text-sm line-clamp-1" : "line-clamp-5"
              )}
            >
              {habit.title}
            </span>
            <div>
              {typeof streak !== "undefined" && streak > 0 ? (
                <div className="flex items-center gap-1 text-chart-1">
                  <FireIcon className="size-4" />
                  <span className="text-xs">{streak}d</span>
                </div>
              ) : isNew ? (
                <span className="text-xs text-primary">new!</span>
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
          {(habit.kind === "quantified" || habit.kind === "time") &&
            inlineValueInput && (
              <div className="relative w-32 pixel-frame">
                <>
                  <Input
                    aria-label={`value-${habit.id}`}
                    className="w-32 pr-12 bg-background"
                    type={habit.kind === "time" ? "time" : "number"}
                    defaultValue={
                      habit.kind === "time"
                        ? typeof entry?.value === "number"
                          ? `${String(Math.floor(entry.value / 60)).padStart(
                              2,
                              "0"
                            )}:${String(entry.value % 60).padStart(2, "0")}`
                          : ""
                        : entry?.value ?? ""
                    }
                    onBlur={(ev) => {
                      const raw = ev.currentTarget.value.trim();
                      if (habit.kind === "time") {
                        // Expect HH:MM, convert to minutes
                        if (raw === "") onSetValue(null);
                        else {
                          const [hh, mm] = raw.split(":").map((s) => Number(s));
                          const minutes =
                            (Number.isFinite(hh) ? hh : 0) * 60 +
                            (Number.isFinite(mm) ? mm : 0);
                          onSetValue(minutes);
                        }
                      } else {
                        onSetValue(raw === "" ? null : Number(raw));
                      }
                    }}
                  />
                  <div className="pointer-events-none absolute right-2 bottom-1 text-xs text-muted-foreground max-w-16 truncate">
                    {habit.kind === "time" ? "hh:mm" : habit.unit ?? ""}
                  </div>
                </>
              </div>
            )}
          <Button aria-label="Edit habit" onClick={onEdit} size="icon-sm">
            {isEditing ? (
              <CloseIcon className="size-6" />
            ) : (
              <EditIcon className="size-6" />
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
  const [kindConfirmOpen, setKindConfirmOpen] = useState(false);
  const qc = useQueryClient();
  return (
    <div className="mt-1 grid gap-3 grid-cols-1 sm:grid-cols-2">
      <label className="flex items-center gap-3 col-span-full sm:col-span-2">
        <span className="w-24 text-sm">Title</span>
        <Input
          value={draft.title}
          className="bg-background"
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-3">
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
              <SelectItem value="time">Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </label>
      <label className="flex items-center gap-3">
        <span
          className={cn(
            "w-24 text-sm",
            (draft.kind === "boolean" || draft.kind === "time") && "opacity-50"
          )}
        >
          Unit
        </span>
        <Input
          value={draft.unit ?? ""}
          className="bg-background"
          disabled={draft.kind === "boolean" || draft.kind === "time"}
          onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-3">
        <span
          className={cn(
            "w-24 text-sm",
            draft.kind === "boolean" && "opacity-50"
          )}
        >
          Target
        </span>
        {draft.kind === "time" ? (
          <Input
            type="time"
            className="bg-background"
            value={
              typeof draft.target === "number"
                ? `${String(Math.floor(draft.target / 60)).padStart(
                    2,
                    "0"
                  )}:${String(draft.target % 60).padStart(2, "0")}`
                : ""
            }
            disabled={false}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") setDraft({ ...draft, target: null });
              else {
                const [hh, mm] = raw.split(":").map((s) => Number(s));
                const minutes =
                  (Number.isFinite(hh) ? hh : 0) * 60 +
                  (Number.isFinite(mm) ? mm : 0);
                setDraft({ ...draft, target: minutes });
              }
            }}
          />
        ) : (
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
        )}
      </label>
      <label className="flex items-center gap-3">
        <span
          className={cn(
            "w-24 text-sm",
            draft.kind === "boolean" && "opacity-50"
          )}
        >
          Min
        </span>
        {draft.kind === "time" ? (
          <Input
            type="time"
            className="bg-background"
            value={
              typeof draft.min === "number"
                ? `${String(Math.floor(draft.min / 60)).padStart(
                    2,
                    "0"
                  )}:${String(draft.min % 60).padStart(2, "0")}`
                : ""
            }
            disabled={false}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") setDraft({ ...draft, min: null });
              else {
                const [hh, mm] = raw.split(":").map((s) => Number(s));
                const minutes =
                  (Number.isFinite(hh) ? hh : 0) * 60 +
                  (Number.isFinite(mm) ? mm : 0);
                setDraft({ ...draft, min: minutes });
              }
            }}
          />
        ) : (
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
        )}
      </label>
      <label className="flex items-center gap-3">
        <span
          className={cn(
            "w-24 text-sm",
            draft.kind === "boolean" && "opacity-50"
          )}
        >
          Max
        </span>
        {draft.kind === "time" ? (
          <Input
            type="time"
            className="bg-background"
            value={
              typeof draft.max === "number"
                ? `${String(Math.floor(draft.max / 60)).padStart(
                    2,
                    "0"
                  )}:${String(draft.max % 60).padStart(2, "0")}`
                : ""
            }
            disabled={false}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") setDraft({ ...draft, max: null });
              else {
                const [hh, mm] = raw.split(":").map((s) => Number(s));
                const minutes =
                  (Number.isFinite(hh) ? hh : 0) * 60 +
                  (Number.isFinite(mm) ? mm : 0);
                setDraft({ ...draft, max: minutes });
              }
            }}
          />
        ) : (
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
        )}
      </label>

      <label className="flex items-center gap-3">
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
          <Button
            onClick={async () => {
              if (draft.kind !== habit.kind) {
                const count = await db.entries
                  .where("habitId")
                  .equals(habit.id)
                  .count();
                if (count > 0) {
                  setKindConfirmOpen(true);
                  return;
                }
              }
              onSave(draft);
            }}
            size="icon"
          >
            <SaveIcon className="size-8" />
          </Button>

          <Dialog open={kindConfirmOpen} onOpenChange={setKindConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change type and delete history?</DialogTitle>
                <DialogDescription>
                  Changing the type of a habit will delete all its existing
                  daily entries. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraft({ ...draft, kind: habit.kind });
                    setKindConfirmOpen(false);
                  }}
                >
                  Reset Type
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    await db.entries.where("habitId").equals(habit.id).delete();
                    qc.invalidateQueries({ queryKey: ["entries"] });
                    qc.invalidateQueries({ queryKey: ["entries-range"] });
                    setKindConfirmOpen(false);
                    onSave(draft);
                  }}
                >
                  Confirm Change
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
