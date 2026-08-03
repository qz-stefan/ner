"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CollectionResearch, RecipientDrawer } from "./CollectionResearch";
import { RequestEvidenceDrawer, RequestResearch } from "./RequestResearch";

type QuestionIndex = 0 | 1;
type LocalDrawer = "request-evidence" | "recipients" | null;

const QUESTIONS = [
  "叶德辉如何提出请求？",
  "这批书信收录了什么？",
] as const;

const STORAGE_KEY = "ye-question-research-state-v1";

interface StoredResearchState {
  question: QuestionIndex;
  views: [number, number];
  scrollY: number;
}

export function ResearchDrawerShell({
  children,
  onClose,
  label,
  wide = false,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  wide?: boolean;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" className="absolute inset-0 cursor-default bg-[rgba(39,36,42,.32)] backdrop-blur-[1px]" onClick={onClose} aria-label="关闭面板" />
      <aside className={`absolute inset-y-0 right-0 w-full overflow-y-auto border-l border-[var(--line-dark)] bg-[var(--paper)] shadow-[-12px_0_32px_rgba(39,36,42,.11)] ${wide ? "sm:max-w-[920px]" : "sm:max-w-[690px]"}`}>
        {children}
      </aside>
    </div>
  );
}

export default function FeaturedAnalysis({ onOpenCustom }: { onOpenCustom: () => void }) {
  const [question, setQuestion] = useState<QuestionIndex>(0);
  const [views, setViews] = useState<[number, number]>([0, 0]);
  const [phase, setPhase] = useState<"idle" | "leaving" | "entering">("idle");
  const [direction, setDirection] = useState<"left" | "right">("left");
  const [drawer, setDrawer] = useState<LocalDrawer>(null);
  const [restored, setRestored] = useState(false);
  const controlRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number | null>(null);
  const wheelDistance = useRef(0);
  const wheelLocked = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as StoredResearchState;
        if (stored.question === 0 || stored.question === 1) setQuestion(stored.question);
        if (Array.isArray(stored.views) && stored.views.length === 2) setViews([stored.views[0] ?? 0, stored.views[1] ?? 0]);
        if (Number.isFinite(stored.scrollY) && stored.scrollY > 0) {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.scrollTo({ top: stored.scrollY, behavior: "auto" })));
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setRestored(true);
  }, []);

  const persistState = useCallback((scrollY = window.scrollY) => {
    const state: StoredResearchState = { question, views, scrollY };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [question, views]);

  useEffect(() => {
    if (restored) persistState();
  }, [persistState, restored]);

  const switchQuestion = useCallback((next: QuestionIndex) => {
    if (next === question || phase !== "idle") return;
    setDirection(next > question ? "left" : "right");
    setPhase("leaving");
    const swapTimer = window.setTimeout(() => {
      setQuestion(next);
      setPhase("entering");
      controlRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
      const settleTimer = window.setTimeout(() => {
        setPhase("idle");
        window.dispatchEvent(new Event("resize"));
      }, 38);
      timers.current.push(settleTimer);
    }, 145);
    timers.current.push(swapTimer);
  }, [phase, question]);

  const motionClass = phase === "leaving"
    ? direction === "left" ? "-translate-x-5 opacity-0" : "translate-x-5 opacity-0"
    : phase === "entering"
      ? direction === "left" ? "translate-x-5 opacity-0" : "-translate-x-5 opacity-0"
      : "translate-x-0 opacity-100";

  const handleQuestionWheel = (event: React.WheelEvent<HTMLElement>) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 4) return;
    if (event.cancelable) event.preventDefault();
    if (wheelLocked.current) return;
    wheelDistance.current += event.deltaX;
    if (Math.abs(wheelDistance.current) < 58) return;
    wheelLocked.current = true;
    if (wheelDistance.current > 0 && question === 0) switchQuestion(1);
    if (wheelDistance.current < 0 && question === 1) switchQuestion(0);
    wheelDistance.current = 0;
    const unlockTimer = window.setTimeout(() => { wheelLocked.current = false; }, 520);
    timers.current.push(unlockTimer);
  };

  const handleQuestionTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 52) return;
    if (distance < 0 && question === 0) switchQuestion(1);
    if (distance > 0 && question === 1) switchQuestion(0);
  };

  return (
    <section
      className="min-w-0"
      onClickCapture={(event) => {
        const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/letter/"]');
        if (link) persistState(window.scrollY);
      }}
    >
      <header
        ref={controlRef}
        className="scroll-mt-16 border-b border-[var(--line-dark)] py-5"
        onWheel={handleQuestionWheel}
        onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
        onTouchEnd={handleQuestionTouchEnd}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          if (event.key === "ArrowRight" && question === 0) switchQuestion(1);
          if (event.key === "ArrowLeft" && question === 1) switchQuestion(0);
        }}
        tabIndex={0}
      >
        <div className="grid items-center gap-4 sm:grid-cols-[1fr_minmax(360px,1.7fr)_1fr]">
          <p className="text-[10px] font-semibold tracking-[.2em] text-[var(--purple)]">问题研究</p>
          <div className="grid grid-cols-[38px_minmax(0,1fr)_38px] items-center gap-2 text-center">
            <button type="button" className="grid size-9 place-items-center border-0 bg-transparent text-[18px] text-[var(--muted)] transition hover:text-[var(--ink)] disabled:opacity-20" onClick={() => switchQuestion(0)} disabled={question === 0 || phase !== "idle"} aria-label="上一个研究问题">←</button>
            <div>
              <p className="text-[9px] tracking-[.16em] text-[var(--muted)]">{String(question + 1).padStart(2, "0")} / 02</p>
              <h1 className="mt-1 text-[20px] font-semibold tracking-[.04em] text-[var(--ink)] sm:text-[24px]">{QUESTIONS[question]}</h1>
            </div>
            <button type="button" className="grid size-9 place-items-center border-0 bg-transparent text-[18px] text-[var(--muted)] transition hover:text-[var(--ink)] disabled:opacity-20" onClick={() => switchQuestion(1)} disabled={question === 1 || phase !== "idle"} aria-label="下一个研究问题">→</button>
          </div>
          <button
            type="button"
            className="justify-self-start border border-[var(--line-dark)] bg-transparent px-4 py-2 text-[11px] tracking-[.04em] text-[var(--ink)] transition hover:border-[var(--purple)] hover:text-[var(--purple)] sm:justify-self-end"
            onClick={() => { setDrawer(null); onOpenCustom(); }}
          >
            自定义分析
          </button>
        </div>
      </header>

      <div className={`min-w-0 transition-[opacity,transform] duration-[250ms] ease-out ${motionClass}`}>
        {question === 0 ? (
          <RequestResearch
            activeView={views[0]}
            onViewChange={(index) => setViews((current) => [index, current[1]])}
            onOpenEvidence={() => setDrawer("request-evidence")}
          />
        ) : (
          <CollectionResearch
            activeView={views[1]}
            onViewChange={(index) => setViews((current) => [current[0], index])}
            onOpenRecipients={() => setDrawer("recipients")}
          />
        )}
      </div>

      {drawer === "request-evidence" ? (
        <ResearchDrawerShell label="全部请求证据" onClose={() => setDrawer(null)}>
          <RequestEvidenceDrawer onClose={() => setDrawer(null)} />
        </ResearchDrawerShell>
      ) : null}
      {drawer === "recipients" ? (
        <ResearchDrawerShell label="全部通信对象" onClose={() => setDrawer(null)}>
          <RecipientDrawer onClose={() => setDrawer(null)} />
        </ResearchDrawerShell>
      ) : null}
    </section>
  );
}
