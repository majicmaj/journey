import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useSettings } from "@/hooks/useData";
import { toDayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import DayPane from "./DayPane";

export default function Day() {
  const settings = useSettings();
  const baseTodayKey = useMemo(
    () => toDayKey(new Date(), settings.data?.dayStart ?? "00:00"),
    [settings.data?.dayStart]
  );
  const [activeKey, setActiveKey] = useState<string>(baseTodayKey);
  const [headerExpanded, setHeaderExpanded] = useState(false);
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
    const clamped = Math.max(-w, Math.min(w, dx));
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
    } else if (dragX < -threshold) {
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
      className={cn(
        "flex flex-col gap-3 transition-all mt-0 duration-300 overflow-hidden",
        !headerExpanded && "-mt-3"
      )}
    >
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
            baseTodayKey={baseTodayKey}
            onSetDayKey={setActiveKey}
            onPrev={goToPrev}
            onNext={goToNext}
            canGoNext={prevKey < baseTodayKey}
            headerExpanded={headerExpanded}
            setHeaderExpanded={setHeaderExpanded}
          />
        </div>
        <div className="min-w-[100vw] w-[100vw] max-w-none px-3">
          <DayPane
            dayKey={activeKey}
            baseTodayKey={baseTodayKey}
            onSetDayKey={setActiveKey}
            onPrev={goToPrev}
            onNext={goToNext}
            canGoNext={canGoNext}
            headerExpanded={headerExpanded}
            setHeaderExpanded={setHeaderExpanded}
          />
        </div>
        <div className="min-w-[100vw] w-[100vw] max-w-none px-3">
          <DayPane
            dayKey={nextKey}
            baseTodayKey={baseTodayKey}
            onSetDayKey={setActiveKey}
            onPrev={goToPrev}
            onNext={goToNext}
            canGoNext={nextKey < baseTodayKey}
            headerExpanded={headerExpanded}
            setHeaderExpanded={setHeaderExpanded}
          />
        </div>
      </div>
    </div>
  );
}
