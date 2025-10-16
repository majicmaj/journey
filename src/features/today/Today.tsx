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
import { CloseIcon, EditIcon, SaveIcon } from "@/components/pixel/icons";
import { Button } from "@/components/ui/button";

export default function Today() {
  const settings = useSettings();
  const todayKey = useMemo(
    () => toDayKey(new Date(), settings.data?.dayStart ?? "00:00"),
    [settings.data?.dayStart]
  );
  const { habitsQ, entriesQ, summary } = useDaySummary(todayKey);
  const { upsert } = useEntries(todayKey);
  const { create, update } = useHabits();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-3 flex-wrap">
        <div className="w-full sm:w-auto pixel-frame bg-card px-3 py-2">
          {todayKey}
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
              onToggle={() =>
                upsert.mutate({
                  habitId: h.id,
                  date: todayKey,
                  completed: !(entry?.completed ?? false),
                })
              }
              onSetValue={(v) =>
                upsert.mutate({
                  habitId: h.id,
                  date: todayKey,
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
  onSetValue: (v: number) => void;
  onEdit: () => void;
  isEditing: boolean;
  onSaveHabit: (next: Habit) => void;
  onCancelEdit: () => void;
}) {
  return (
    <PixelCard className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            aria-label={entry?.completed ? "Mark incomplete" : "Mark complete"}
            className={cn(
              "pixel-frame h-6 w-6 bg-background",
              entry?.completed && "bg-primary"
            )}
            onClick={onToggle}
          />
          <div>{habit.title}</div>
        </div>
        <div className="flex items-end gap-3">
          <div className="relative w-32">
            {habit.kind === "quantified" && inlineValueInput ? (
              <>
                <PixelInput
                  aria-label={`value-${habit.id}`}
                  className="w-32 pr-12"
                  type="number"
                  defaultValue={entry?.value ?? 0}
                  onBlur={(ev) => onSetValue(Number(ev.currentTarget.value))}
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
  return (
    <div className="mt-1 grid gap-2 grid-cols-1 sm:grid-cols-2">
      <label className="flex items-center gap-2">
        <span className="w-24 text-sm">Kind</span>
        <select
          className="pixel-frame bg-background px-2 py-1"
          value={draft.kind}
          onChange={(e) =>
            setDraft({ ...draft, kind: e.target.value as Habit["kind"] })
          }
        >
          <option value="boolean">Boolean</option>
          <option value="quantified">Quantified</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="w-24 text-sm">Unit</span>
        <PixelInput
          value={draft.unit ?? ""}
          onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="w-24 text-sm">Target</span>
        <PixelInput
          type="number"
          value={draft.target ?? 0}
          onChange={(e) =>
            setDraft({ ...draft, target: Number(e.target.value) })
          }
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="w-24 text-sm">Min</span>
        <PixelInput
          type="number"
          value={draft.min ?? 0}
          onChange={(e) => setDraft({ ...draft, min: Number(e.target.value) })}
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="w-24 text-sm">Max</span>
        <PixelInput
          type="number"
          value={draft.max ?? 0}
          onChange={(e) => setDraft({ ...draft, max: Number(e.target.value) })}
        />
      </label>

      <label className="flex items-center gap-2">
        <span className="w-24 text-sm">Weight</span>
        <PixelInput
          type="number"
          value={draft.weight}
          onChange={(e) =>
            setDraft({ ...draft, weight: Number(e.target.value) })
          }
        />
      </label>
      <div className="col-span-full flex gap-2 justify-end">
        <button className="pixel-frame px-3 py-1" onClick={onCancel}>
          <CloseIcon className="size-4" />
        </button>
        <button
          className="pixel-frame px-3 py-1 bg-primary text-primary-foreground"
          onClick={() => onSave(draft)}
        >
          <SaveIcon className="size-4" />
        </button>
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
        className="bg-secondary h-full"
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
