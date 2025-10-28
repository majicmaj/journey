export type HabitId = string;
export type Unit = string;

export interface Habit {
  id: HabitId;
  title: string;
  icon?: string;
  color?: string;
  tags?: string[];
  weight: number; // default 1.0, [0.1 .. 5.0]
  // Unified model: every habit can track quantity and time
  quantityUnit?: Unit;
  // Thresholds for quantity-based completion/scoring
  minQuantity?: number | null;
  maxQuantity?: number | null;
  // Thresholds for time-based completion/scoring (minutes)
  minTimeMinutes?: number | null;
  maxTimeMinutes?: number | null;
  // Thresholds for total duration across all logs in a day (minutes)
  minDurationMinutes?: number | null;
  maxDurationMinutes?: number | null;
  // How to compute contribution when both dimensions exist
  scoreMode?: "quantity" | "time" | "both" | undefined; // default "both"
  // Legacy fields (kept for backward compatibility when reading existing data)
  /** @deprecated */ kind?: "boolean" | "quantified" | "time";
  /** @deprecated */ unit?: Unit;
  /** @deprecated */ target?: number | null;
  /** @deprecated */ min?: number | null;
  /** @deprecated */ max?: number | null;
  createdAt: string; // ISO
  archivedAt?: string | null;
}

export interface DailyEntry {
  habitId: HabitId;
  date: string; // YYYY-MM-DD (user TZ, respecting day start)
  completed?: boolean; // compact logging
  // Unified fields
  quantity?: number | null; // legacy flat field
  // Store raw start/end (minutes since day start). timeMinutes is derived.
  startMinutes?: number | null; // legacy flat field
  endMinutes?: number | null; // legacy flat field
  // Multiple logs per day
  logs?: Array<{
    id: string;
    quantity: number | null;
    startMinutes: number | null;
    endMinutes: number | null;
    editedAt?: string;
  }>;
  // Legacy fields (kept for backward compatibility)
  /** @deprecated */ value?: number | boolean | null;
  /** @deprecated */ kindAtEntry?: Habit["kind"]; // "boolean" | "quantified" | "time"
  note?: string | null;
  editedAt?: string;
}

export interface DaySummaryByHabit {
  habitId: HabitId;
  contribution: number; // 0..100 after normalization per habit
  completed: boolean;
  // For display convenience in lists; optional aggregate of entry data
  value?: number | boolean | null;
}

export interface DaySummary {
  date: string;
  totalScore: number; // 0..100
  byHabit: DaySummaryByHabit[];
}
