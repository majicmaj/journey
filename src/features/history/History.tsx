import { useMemo, useState } from "react";
import { useEntries, useSettings } from "@/hooks/useData";
import { toDayKey } from "@/lib/dates";
import { PixelCard } from "@/components/pixel";

export default function History() {
  const { data: settings } = useSettings();
  const [days] = useState(30);
  const keys = useMemo(() => {
    const today = new Date();
    const arr: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(toDayKey(d, settings?.dayStart ?? "00:00"));
    }
    return arr;
  }, [days, settings?.dayStart]);

  return (
    <div className="flex flex-col gap-4">
      <Heatmap keys={keys} />
      <div className="flex flex-col gap-3">
        {keys.map((k) => (
          <DayRow key={k} dateKey={k} />
        ))}
      </div>
    </div>
  );
}

function DayRow({ dateKey }: { dateKey: string }) {
  const { data } = useEntries(dateKey);
  const count = data?.length ?? 0;
  return (
    <PixelCard>
      <div className="flex justify-between">
        <div>{dateKey}</div>
        <div className="text-muted-foreground">{count} entries</div>
      </div>
    </PixelCard>
  );
}

function Heatmap({ keys }: { keys: string[] }) {
  const maxCols = 15;
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))` }}
    >
      {keys.map((k) => (
        <div key={k} className="pixel-frame h-4 w-4 bg-muted" title={k} />
      ))}
    </div>
  );
}
