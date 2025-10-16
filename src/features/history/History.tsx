import { useMemo, useState } from "react";
import {
  useEntries,
  useSettings,
  useDailySummariesRange,
  useHabits,
} from "@/hooks/useData";
import { toDayKey } from "@/lib/dates";
import { PixelCard, PixelInput, PixelButton } from "@/components/pixel";
import type { DailyEntry } from "@/types/habit";

export default function History() {
  const { data: settings } = useSettings();
  const [range, setRange] = useState<7 | 14 | 30 | 90 | 180>(30);
  const keys = useMemo(() => {
    const today = new Date();
    const arr: string[] = [];
    for (let i = 0; i < range; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(toDayKey(d, settings?.dayStart ?? "00:00"));
    }
    return arr;
  }, [range, settings?.dayStart]);
  const from = keys[keys.length - 1];
  const to = keys[0];
  const { summaries } = useDailySummariesRange(from, to);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Timeframe:</span>
        {[7, 14, 30, 90, 180].map((d) => (
          <button
            key={d}
            className={`pixel-frame px-2 py-1 ${
              range === d
                ? "bg-primary text-primary-foreground"
                : "bg-background"
            }`}
            onClick={() => setRange(d as 7 | 14 | 30 | 90 | 180)}
          >
            {d}d
          </button>
        ))}
      </div>
      <HeatmapWithLabels
        summaries={summaries ?? []}
        onSelect={(k) => setSelected(k)}
        selected={selected}
      />
      <div className="flex flex-col gap-3">
        {keys.map((k) => (
          <DayRow key={k} dateKey={k} onSelect={() => setSelected(k)} />
        ))}
      </div>
      {selected ? (
        <DayEditor dateKey={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

function DayRow({
  dateKey,
  onSelect,
}: {
  dateKey: string;
  onSelect: () => void;
}) {
  const { data } = useEntries(dateKey);
  const count = data?.length ?? 0;
  return (
    <PixelCard className="cursor-pointer" onClick={onSelect}>
      <div className="flex justify-between">
        <div>{dateKey}</div>
        <div className="text-muted-foreground">{count} entries</div>
      </div>
    </PixelCard>
  );
}

const colors = {
  100: "bg-primary",
  90: "bg-primary/90",
  80: "bg-primary/80",
  70: "bg-primary/70",
  60: "bg-primary/60",
  50: "bg-primary/50",
  40: "bg-primary/40",
  30: "bg-primary/30",
  20: "bg-primary/20",
  10: "bg-primary/10",
  0: "bg-transparent",
};

function HeatmapWithLabels({
  summaries,
  onSelect,
  selected,
}: {
  summaries: Array<{ date: string; totalScore: number }>;
  onSelect: (k: string) => void;
  selected: string | null;
}) {
  const maxCols = Math.ceil(summaries.length / 7);
  const colorFor = (v: number) => colors[v];

  return (
    <div className="flex flex-col gap-2">
      <div
        className="grid gap-1 w-max"
        style={{ gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))` }}
      >
        {summaries.map((s) => (
          <button
            key={s.date}
            className={`pixel-frame h-4 w-4 ${colorFor(s.totalScore)} ${
              selected === s.date ? "outline-2 outline-ring" : ""
            }`}
            title={`${s.date}: ${s.totalScore}`}
            onClick={() => onSelect(s.date)}
          />
        ))}
      </div>
      <div className="text-xs text-muted-foreground flex justify-between">
        <span>{summaries[0]?.date ?? ""}</span>
        <span>{summaries[summaries.length - 1]?.date ?? ""}</span>
      </div>
    </div>
  );
}

function DayEditor({
  dateKey,
  onClose,
}: {
  dateKey: string;
  onClose: () => void;
}) {
  const { data: habits } = useHabits();
  const { data: entries, upsert } = useEntries(dateKey);
  const map = new Map(entries?.map((e) => [e.habitId, e] as const));
  return (
    <PixelCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Edit {dateKey}</div>
        <PixelButton onClick={onClose}>Close</PixelButton>
      </div>
      <div className="flex flex-col gap-2">
        {(habits ?? []).map((h) => {
          const e = map.get(h.id);
          const togglePayload: DailyEntry = {
            habitId: h.id,
            date: dateKey,
            completed: !(e?.completed ?? false),
            value: e?.value ?? null,
          };
          const toggle = () => upsert.mutate(togglePayload);

          const setValue = (v: number) => {
            const payload: DailyEntry = {
              habitId: h.id,
              date: dateKey,
              value: v,
              completed:
                h.kind === "boolean"
                  ? e?.completed ?? false
                  : e?.completed ?? false,
            };
            upsert.mutate(payload);
          };
          return (
            <div key={h.id} className="flex items-center gap-2">
              <button
                className={`pixel-frame h-6 w-6 ${
                  e?.completed ? "bg-primary" : "bg-background"
                }`}
                aria-label="toggle"
                onClick={toggle}
              />
              <div className="flex-1">{h.title}</div>
              {h.kind === "quantified" ? (
                <PixelInput
                  aria-label={`value-${h.id}`}
                  className="w-24"
                  type="number"
                  defaultValue={e?.value ?? 0}
                  onBlur={(ev) => setValue(Number(ev.currentTarget.value))}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </PixelCard>
  );
}
