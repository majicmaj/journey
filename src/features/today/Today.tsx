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

export default function Today() {
  const settings = useSettings();
  const todayKey = useMemo(
    () => toDayKey(new Date(), settings.data?.dayStart ?? "00:00"),
    [settings.data?.dayStart]
  );
  const { habitsQ, entriesQ, summary } = useDaySummary(todayKey);
  const { upsert } = useEntries(todayKey);
  const { create } = useHabits();
  const [title, setTitle] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <div className="pixel-frame bg-card px-3 py-2">{todayKey}</div>
        <Progress value={summary?.totalScore ?? 0} />
      </header>

      <section className="flex flex-col gap-3">
        {(habitsQ.data ?? []).map((h) => (
          <HabitRow
            key={h.id}
            habit={h}
            entry={(entriesQ.data ?? []).find((e) => e.habitId === h.id)}
            onToggle={() =>
              upsert.mutate({
                habitId: h.id,
                date: todayKey,
                completed: !Boolean(
                  (entriesQ.data ?? []).find((e) => e.habitId === h.id)
                    ?.completed
                ),
              })
            }
          />
        ))}
      </section>

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
  onToggle,
}: {
  habit: Habit;
  entry: { completed?: boolean } | undefined;
  onToggle: () => void;
}) {
  return (
    <PixelCard className="flex items-center justify-between">
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
      {habit.kind === "quantified" ? (
        <div className="text-muted-foreground">{habit.unit ?? ""}</div>
      ) : null}
    </PixelCard>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div
      className="pixel-frame bg-background h-6 w-64 relative"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div
        className="bg-primary h-full"
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
