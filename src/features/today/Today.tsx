import { useMemo, useState } from "react";
import { PixelButton, PixelCard, PixelInput } from "@/components/pixel";
import {
  useDaySummary,
  useEntries,
  useHabits,
  useSettings,
} from "@/hooks/useData";
import { toDayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { type Habit } from "@/types/habit";
import {
  CloseIcon,
  EditIcon,
  SaveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
} from "@/components/pixel/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3">
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
            <ChevronLeftIcon className="size-6" />
          </Button>
          <div className="pixel-frame bg-card">
            <Input
              aria-label="Select date"
              type="date"
              className="bg-card px-2 py-1"
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
            <ChevronRightIcon className="size-6" />
          </Button>
          <Button
            className="ml-2"
            onClick={() => setActiveKey(baseTodayKey)}
            aria-label="Go to today"
          >
            Today
          </Button>
        </div>
        <Progress
          className="w-full sm:w-64 p"
          value={summary?.totalScore ?? 0}
        />
      </header>

      <div className="border-2 border-border w-full h-px my-2" />

      <section className="flex flex-col gap-3">
        {(habitsQ.data ?? []).map((h) => {
          const entry = (entriesQ.data ?? []).find((e) => e.habitId === h.id);
          return (
            <HabitRow
              key={h.id}
              habit={h}
              entry={entry}
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
        <PixelInput
          aria-label="New habit title"
          placeholder="New habit title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1"
        />
        <PixelButton
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
        >
          Add
        </PixelButton>
      </footer>
    </div>
  );
}

function HabitRow({
  habit,
  entry,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            aria-label={entry?.completed ? "Mark incomplete" : "Mark complete"}
            size="icon"
            variant={entry?.completed ? "secondary" : "outline"}
            onClick={onToggle}
          >
            {entry?.completed && <CheckIcon className="text-light size-6" />}
          </Button>
          <div>{habit.title}</div>
        </div>
        <div className="flex items-end gap-3">
          <div className="relative w-32">
            {habit.kind === "quantified" && inlineValueInput ? (
              <>
                <PixelInput
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
            ) : (
              <div className="w-32" />
            )}
          </div>
          <Button aria-label="Edit habit" onClick={onEdit} size="icon">
            <EditIcon className="size-6" />
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
  return (
    <div className="mt-1 grid gap-3 grid-cols-1 sm:grid-cols-2">
      <label className="flex items-center gap-2">
        <span className="w-24 text-sm">Kind</span>
        <div className="pixel-frame w-full">
          <select
            className="bg-background px-2 py-2 w-full"
            value={draft.kind}
            onChange={(e) =>
              setDraft({ ...draft, kind: e.target.value as Habit["kind"] })
            }
          >
            <option value="boolean">Boolean</option>
            <option value="quantified">Quantified</option>
          </select>
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
        <PixelInput
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
        <PixelInput
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
        <PixelInput
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
        <PixelInput
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
        <PixelInput
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
      <div className="col-span-full flex gap-3 justify-end">
        <Button onClick={onCancel} size="icon" variant="outline">
          <CloseIcon className="size-5" />
        </Button>
        <Button onClick={() => onSave(draft)} size="icon">
          <SaveIcon className="size-5" />
        </Button>
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
      <div className="absolute inset-0 grid grid-cols-10 opacity-30">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="border-r border-border" />
        ))}
      </div>
    </div>
  );
}
