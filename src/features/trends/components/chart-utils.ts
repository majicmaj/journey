export function weekMonthAbbr(weekStartStr: string): string | null {
  if (!weekStartStr) return null;
  const ws = new Date(weekStartStr + "T00:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws.getTime() + i * 86400000);
    if (d.getDate() === 1) {
      return [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ][d.getMonth()];
    }
  }
  return null;
}

export function isCompactAxis(from: string, to: string): boolean {
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  const days = Math.max(1, Math.round((+end - +start) / 86400000) + 1);
  const threshold =
    typeof window !== "undefined" && window.innerWidth <= 640 ? 30 : 90;
  return days >= threshold;
}

/** keeps your palette mapping logic in one place */
export function habitColorAt(index: number, fallback?: string): string {
  const varIdx = (index % 5) + 1;
  return fallback ?? `var(--chart-${varIdx})`;
}
