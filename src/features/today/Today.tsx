import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useSettings } from "@/hooks/useData";
import { toDayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import DayPane from "./DayPane";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@/components/pixel/icons";

type DaySortKey =
  | "title"
  | "weight"
  | "createdAt"
  | "completed"
  | "value"
  | "contribution";

export default function Day() {
  const settings = useSettings();
  const baseTodayKey = useMemo(
    () => toDayKey(new Date(), settings.data?.dayStart ?? "00:00"),
    [settings.data?.dayStart]
  );
  const [activeKey, setActiveKey] = useState<string>(baseTodayKey);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [sortKey, setSortKey] = useState<DaySortKey>("weight");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterKind, setFilterKind] = useState<
    "all" | "boolean" | "quantified" | "time"
  >("all");
  const [filterCompletion, setFilterCompletion] = useState<
    "all" | "completed" | "incomplete"
  >("all");
  // Swipe state
  const swipeContainerRef = useRef<HTMLDivElement | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isAnimatingRef = useRef(false);
  // Range entries for streak calculation
  const dayStart = settings.data?.dayStart ?? "00:00";
  const prevKey = useMemo(() => {
    const d = new Date(
      new Date(activeKey + "T00:00:00").getTime() - 24 * 60 * 60 * 1000
    );
    return toDayKey(d, dayStart);
  }, [activeKey, dayStart]);
  const nextKey = useMemo(() => {
    const d = new Date(
      new Date(activeKey + "T00:00:00").getTime() + 24 * 60 * 60 * 1000
    );
    return toDayKey(d, dayStart);
  }, [activeKey, dayStart]);
  const canGoNext = activeKey < baseTodayKey;

  // Track panel width (viewport width) for 3-panel layout
  const [panelW, setPanelW] = useState(0);
  useEffect(() => {
    const update = () => {
      setPanelW(Math.max(1, window.innerWidth));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  function animateToDay(direction: "prev" | "next") {
    if (isAnimatingRef.current) return;
    if (direction === "next" && !canGoNext) {
      // Bounce
      const w = panelW;
      isAnimatingRef.current = true;
      setIsTransitioning(true);
      setDragX(-Math.min(80, Math.floor(w * 0.1)));
      window.setTimeout(() => {
        setDragX(0);
        window.setTimeout(() => {
          setIsTransitioning(false);
          isAnimatingRef.current = false;
        }, 180);
      }, 120);
      return;
    }

    const w = panelW;
    isAnimatingRef.current = true;
    setIsTransitioning(true);
    // Slide to reveal neighbor
    setDragX(direction === "prev" ? w : -w);
    window.setTimeout(() => {
      // Switch active day and reset position
      setIsTransitioning(false);
      setActiveKey(direction === "prev" ? prevKey : nextKey);
      setDragX(0);
      window.requestAnimationFrame(() => {
        setIsTransitioning(true);
        window.setTimeout(() => {
          setIsTransitioning(false);
          isAnimatingRef.current = false;
        }, 200);
      });
    }, 260);
  }

  function goToPrev() {
    animateToDay("prev");
  }
  function goToNext() {
    animateToDay("next");
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (isAnimatingRef.current) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    setIsTransitioning(false);
  }
  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (isAnimatingRef.current) return;
    const start = touchStartRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Only react if primarily horizontal
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    const w = panelW;
    // Block left swipe when at today (we don't show tomorrow)
    const intendedDx = !canGoNext && dx < 0 ? 0 : dx;
    const clamped = Math.max(-w, Math.min(w, intendedDx));
    setDragX(clamped);
  }
  function onTouchEnd() {
    if (isAnimatingRef.current) return;
    touchStartRef.current = null;
    const w = panelW;
    // Distance threshold is 20% of width
    const threshold = Math.floor(w * 0.2);
    if (dragX > threshold) {
      // Swipe right → previous day
      setIsTransitioning(true);
      setDragX(w);
      animateToDay("prev");
    } else if (dragX < -threshold && canGoNext) {
      // Swipe left → next day (if available)
      setIsTransitioning(true);
      setDragX(-w);
      animateToDay("next");
    } else {
      // Snap back
      setIsTransitioning(true);
      setDragX(0);
      window.setTimeout(() => setIsTransitioning(false), 200);
    }
  }

  return (
    <div
      ref={swipeContainerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={
        "flex flex-col gap-3 transition-all mt-0 duration-300 overflow-hidden"
      }
    >
      <div className="p-2 gap-3 flex flex-col">
        <DayHeader
          dayKey={activeKey}
          baseTodayKey={baseTodayKey}
          canGoNext={canGoNext}
          onPrev={goToPrev}
          onNext={goToNext}
          onSetDayKey={setActiveKey}
          dayStart={settings.data?.dayStart ?? "00:00"}
          headerExpanded={headerExpanded}
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortDir={sortDir}
          setSortDir={setSortDir}
          filterKind={filterKind}
          setFilterKind={setFilterKind}
          filterCompletion={filterCompletion}
          setFilterCompletion={setFilterCompletion}
        />
        <Button
          variant={headerExpanded ? "secondary" : "ghost"}
          className={cn("w-full", !headerExpanded && "-mt-2")}
          size="icon"
          onClick={() => setHeaderExpanded((prev) => !prev)}
        >
          {headerExpanded ? (
            <ChevronUpIcon className="size-8" />
          ) : (
            <ChevronDownIcon className="size-8" />
          )}
        </Button>
      </div>
      <div
        className={cn(
          isTransitioning ? "transition-transform duration-300 ease-out" : "",
          "will-change-transform flex gap-0 w-[300vw]"
        )}
        style={{
          transform: `translateX(${panelW ? -panelW + dragX : 0}px)`,
        }}
      >
        <div className="min-w-[100vw] w-[100vw] max-w-none px-3">
          <DayPane
            dayKey={prevKey}
            headerExpanded={headerExpanded}
            sortKey={sortKey}
            sortDir={sortDir}
            filterKind={filterKind}
            filterCompletion={filterCompletion}
          />
        </div>
        <div className="min-w-[100vw] w-[100vw] max-w-none px-3">
          <DayPane
            dayKey={activeKey}
            headerExpanded={headerExpanded}
            sortKey={sortKey}
            sortDir={sortDir}
            filterKind={filterKind}
            filterCompletion={filterCompletion}
          />
        </div>
        <div className="min-w-[100vw] w-[100vw] max-w-none px-3">
          <DayPane
            dayKey={nextKey}
            headerExpanded={headerExpanded}
            sortKey={sortKey}
            sortDir={sortDir}
            filterKind={filterKind}
            filterCompletion={filterCompletion}
          />
        </div>
      </div>
    </div>
  );
}

function DayHeader({
  dayKey,
  baseTodayKey,
  canGoNext,
  onPrev,
  onNext,
  onSetDayKey,
  dayStart,
  headerExpanded,
  sortKey,
  setSortKey,
  sortDir,
  setSortDir,
  filterKind,
  setFilterKind,
  filterCompletion,
  setFilterCompletion,
}: {
  dayKey: string;
  baseTodayKey: string;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSetDayKey: (k: string) => void;
  dayStart: string;
  headerExpanded: boolean;
  sortKey:
    | "title"
    | "weight"
    | "createdAt"
    | "completed"
    | "value"
    | "contribution";
  setSortKey: (
    v: "title" | "weight" | "createdAt" | "completed" | "value" | "contribution"
  ) => void;
  sortDir: "asc" | "desc";
  setSortDir: (v: "asc" | "desc") => void;
  filterKind: "all" | "boolean" | "quantified" | "time";
  setFilterKind: (v: "all" | "boolean" | "quantified" | "time") => void;
  filterCompletion: "all" | "completed" | "incomplete";
  setFilterCompletion: (v: "all" | "completed" | "incomplete") => void;
}) {
  return (
    <header
      className={cn(
        "h-0 transition-all duration-300 overflow-hidden",
        headerExpanded && "h-50"
      )}
    >
      <div className="m-1 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto sm:flex-0">
          <Button aria-label="Previous day" size="icon" onClick={onPrev}>
            <ChevronLeftIcon className="size-8" />
          </Button>
          <div className="pixel-frame bg-card flex-1">
            <Input
              aria-label="Select date"
              type="date"
              key={dayKey}
              className="w-full bg-card px-2 py-1 text-foreground"
              value={dayKey}
              onChange={(e) =>
                onSetDayKey(toDayKey(e.target.value, dayStart ?? "00:00"))
              }
            />
          </div>
          <Button
            aria-label="Next day"
            size="icon"
            onClick={onNext}
            disabled={!canGoNext || dayKey >= baseTodayKey}
          >
            <ChevronRightIcon className="size-8" />
          </Button>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => onSetDayKey(baseTodayKey)}
          aria-label="Go to today"
          disabled={dayKey === baseTodayKey}
        >
          Today
        </Button>
        <div className="grid grid-cols-2 mt-2 w-full sm:flex items-center gap-3 flex-wrap">
          <div className="pixel-frame">
            <Select
              value={sortKey}
              onValueChange={(v: DaySortKey) => setSortKey(v)}
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
                <SelectItem value="contribution">Sort: Contribution</SelectItem>
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
              onValueChange={(v: "all" | "boolean" | "quantified" | "time") =>
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
                <SelectItem value="time">Time</SelectItem>
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
  );
}
