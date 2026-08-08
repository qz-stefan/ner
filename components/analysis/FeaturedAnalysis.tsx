"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CollectionResearch, RecipientDrawer } from "./CollectionResearch";
import { RequestEvidenceDrawer, RequestResearch } from "./RequestResearch";

type PageIndex = 0 | 1 | 2;
type LocalDrawer = "request-evidence" | "recipients" | null;

const PAGES = [
  "这批书信收录了什么？",
  "叶德辉如何提出请求？",
  "自定义分析",
] as const;

const STORAGE_KEY = "ye-question-research-state-v2";

interface StoredResearchState {
  page: PageIndex;
  views: [number, number];
  scrollY: number;
}

export function ResearchDrawerShell({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
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
      <aside className="absolute inset-y-0 right-0 w-full overflow-y-auto border-l border-[var(--line-dark)] bg-[var(--paper)] shadow-[-12px_0_32px_rgba(39,36,42,.11)] sm:max-w-[690px]">
        {children}
      </aside>
    </div>
  );
}

export default function FeaturedAnalysis({ customContent }: { customContent: ReactNode }) {
  const [page, setPage] = useState<PageIndex>(0);
  const [views, setViews] = useState<[number, number]>([0, 0]);
  const [phase, setPhase] = useState<"idle" | "leaving" | "entering">("idle");
  const [drawer, setDrawer] = useState<LocalDrawer>(null);
  const [restored, setRestored] = useState(false);
  const controlRef = useRef<HTMLElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as StoredResearchState;
        if (stored.page === 0 || stored.page === 1 || stored.page === 2) setPage(stored.page);
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
    const state: StoredResearchState = { page, views, scrollY };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [page, views]);

  useEffect(() => {
    if (restored) persistState();
  }, [persistState, restored]);

  const switchPage = useCallback((next: PageIndex) => {
    if (next === page || phase !== "idle") return;
    setDrawer(null);
    setPhase("leaving");
    const swapTimer = window.setTimeout(() => {
      setPage(next);
      setPhase("entering");
      controlRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
      const settleTimer = window.setTimeout(() => {
        setPhase("idle");
        window.dispatchEvent(new Event("resize"));
      }, 42);
      timers.current.push(settleTimer);
    }, 120);
    timers.current.push(swapTimer);
  }, [page, phase]);

  const motionClass = phase === "idle" ? "opacity-100" : "opacity-0";

  return (
    <section
      className="min-w-0"
      onClickCapture={(event) => {
        const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/letter/"]');
        if (link) persistState(window.scrollY);
      }}
    >
      <header ref={controlRef} className="scroll-mt-16 border-b border-[var(--line-dark)] py-5">
        <div className="grid items-center gap-4 sm:grid-cols-[1fr_minmax(380px,1.6fr)_1fr]">
          <p className="text-[10px] font-semibold tracking-[.2em] text-[var(--purple)]">问题研究</p>
          <div className="text-center">
            <nav className="flex items-center justify-center gap-9" aria-label="问题研究页面">
              {PAGES.map((title, index) => {
                const active = page === index;
                return (
                  <button
                    type="button"
                    className={`relative border-0 bg-transparent px-1 pb-2 text-[14px] tabular-nums tracking-[.14em] transition focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-[var(--purple)] ${active ? "text-[var(--ink)]" : "cursor-pointer text-[var(--muted)] opacity-45 hover:opacity-100 hover:text-[var(--ink)]"}`}
                    onClick={() => switchPage(index as PageIndex)}
                    aria-current={active ? "page" : undefined}
                    aria-label={`${String(index + 1).padStart(2, "0")} ${title}`}
                    key={title}
                  >
                    {String(index + 1).padStart(2, "0")}
                    <i className={`absolute inset-x-1 bottom-0 h-px not-italic transition ${active ? "bg-[var(--purple)]" : "bg-transparent"}`} />
                  </button>
                );
              })}
            </nav>
            <h1 className="mt-3 text-[20px] font-semibold tracking-[.04em] text-[var(--ink)] sm:text-[24px]">{PAGES[page]}</h1>
          </div>
          <p className="hidden justify-self-end text-[9px] tracking-[.08em] text-[var(--muted)] sm:block">三个平级研究页</p>
        </div>
      </header>

      <div className={`min-w-0 transition-opacity duration-200 ease-out ${motionClass}`}>
        {page === 0 ? (
          <CollectionResearch
            activeView={views[0]}
            onViewChange={(index) => setViews((current) => [index, current[1]])}
            onOpenRecipients={() => setDrawer("recipients")}
          />
        ) : null}
        {page === 1 ? (
          <RequestResearch
            activeView={views[1]}
            onViewChange={(index) => setViews((current) => [current[0], index])}
            onOpenEvidence={() => setDrawer("request-evidence")}
          />
        ) : null}
        {page === 2 ? customContent : null}
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
