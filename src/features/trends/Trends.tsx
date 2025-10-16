import { useMemo, useState } from "react";
import { useSettings } from "@/hooks/useData";
import { toDayKey } from "@/lib/dates";

export default function Trends() {
  const { data: settings } = useSettings();
  const [days] = useState(14);
  const keys = useMemo(() => {
    const today = new Date();
    const arr: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(toDayKey(d, settings?.dayStart ?? "00:00"));
    }
    return arr;
  }, [days, settings?.dayStart]);

  return (
    <div className="flex flex-col gap-4">
      <div className="pixel-frame bg-card p-3">Trends</div>
      <MiniLine keys={keys} />
      <div className="text-muted-foreground text-sm">
        Per-habit rates (stub)
      </div>
    </div>
  );
}

function MiniLine({ keys }: { keys: string[] }) {
  const w = 300,
    h = 60,
    pad = 4;
  return (
    <svg width={w} height={h} className="pixel-frame bg-background">
      {keys.map((_, i) => (
        <rect
          key={i}
          x={pad + i * ((w - pad * 2) / keys.length)}
          y={h / 2}
          width={2}
          height={2}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
