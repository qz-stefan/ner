"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface ResearchCarouselProps {
  labels: readonly string[];
  activeIndex: number;
  onChange: (index: number) => void;
  children: ReactNode;
  ariaLabel: string;
}

export function ResearchCarousel({
  labels,
  activeIndex,
  onChange,
  children,
  ariaLabel,
}: ResearchCarouselProps) {
  const [phase, setPhase] = useState<"idle" | "leaving" | "entering">("idle");
  const [direction, setDirection] = useState<"left" | "right">("left");
  const touchStartX = useRef<number | null>(null);
  const wheelDistance = useRef(0);
  const wheelLocked = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const goTo = useCallback((next: number) => {
    if (phase !== "idle" || next === activeIndex || next < 0 || next >= labels.length) return;
    setDirection(next > activeIndex ? "left" : "right");
    setPhase("leaving");
    const swapTimer = window.setTimeout(() => {
      onChange(next);
      setPhase("entering");
      const settleTimer = window.setTimeout(() => {
        setPhase("idle");
        window.dispatchEvent(new Event("resize"));
      }, 38);
      timers.current.push(settleTimer);
    }, 145);
    timers.current.push(swapTimer);
  }, [activeIndex, labels.length, onChange, phase]);

  const motionClass = phase === "leaving"
    ? direction === "left" ? "-translate-x-5 opacity-0" : "translate-x-5 opacity-0"
    : phase === "entering"
      ? direction === "left" ? "translate-x-5 opacity-0" : "-translate-x-5 opacity-0"
      : "translate-x-0 opacity-100";

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 52) return;
    goTo(activeIndex + (distance < 0 ? 1 : -1));
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 4) return;
    if (event.cancelable) event.preventDefault();
    if (wheelLocked.current) return;
    wheelDistance.current += event.deltaX;
    if (Math.abs(wheelDistance.current) < 58) return;
    wheelLocked.current = true;
    goTo(activeIndex + (wheelDistance.current > 0 ? 1 : -1));
    wheelDistance.current = 0;
    const unlockTimer = window.setTimeout(() => { wheelLocked.current = false; }, 520);
    timers.current.push(unlockTimer);
  };

  return (
    <section className="mt-5 border-t border-[var(--line-dark)] pt-4" aria-label={ariaLabel}>
      <header className="grid grid-cols-[38px_minmax(0,1fr)_38px] items-center gap-2">
        <button
          type="button"
          className="grid size-9 place-items-center border border-[var(--line)] bg-transparent text-[17px] text-[var(--muted)] transition hover:border-[var(--gold)] hover:text-[var(--ink)] disabled:cursor-default disabled:opacity-20"
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0 || phase !== "idle"}
          aria-label="上一个分析视图"
        >
          ←
        </button>
        <nav className="flex min-w-0 items-center justify-center gap-x-5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={`${ariaLabel}视图索引`}>
          {labels.map((label, index) => (
            <button
              type="button"
              className={`shrink-0 border-0 border-b bg-transparent px-0 pb-1.5 text-[11px] tracking-[.04em] transition ${index === activeIndex ? "border-[var(--purple)] text-[var(--ink)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}
              onClick={() => goTo(index)}
              aria-current={index === activeIndex ? "true" : undefined}
              key={label}
            >
              <span className="mr-1.5 text-[9px] tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              {label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="grid size-9 place-items-center border border-[var(--line)] bg-transparent text-[17px] text-[var(--muted)] transition hover:border-[var(--gold)] hover:text-[var(--ink)] disabled:cursor-default disabled:opacity-20"
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex === labels.length - 1 || phase !== "idle"}
          aria-label="下一个分析视图"
        >
          →
        </button>
      </header>

      <div
        className="mt-3 min-w-0 outline-none"
        tabIndex={0}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
          if (event.key === "ArrowRight") goTo(activeIndex + 1);
          if (event.key === "ArrowLeft") goTo(activeIndex - 1);
        }}
        onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div className={`min-w-0 transition-[opacity,transform] duration-[250ms] ease-out ${motionClass}`}>
          {children}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2" aria-hidden="true">
        {labels.map((label, index) => (
          <i className={`block rounded-full transition-all ${index === activeIndex ? "h-1.5 w-5 bg-[var(--purple)]" : "size-1.5 bg-[var(--line-dark)]"}`} key={label} />
        ))}
      </div>
    </section>
  );
}
