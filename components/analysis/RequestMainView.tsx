"use client";

import { useState } from "react";
import CommunicationAnalysis from "./CommunicationAnalysis";
import { RequestAnalysisView } from "./RequestFindingsPage";

type CommunicationView = "overview" | "findings";

export function RequestMainView() {
  const [communicationView, setCommunicationView] = useState<CommunicationView>("overview");

  return (
    <div className="min-w-0">
      <section aria-labelledby="request-path-overview-title">
        <div className="sr-only" id="request-path-overview-title">请求类型与通信路径总览</div>
        <RequestAnalysisView />
      </section>

      <section className="mt-10 border-t border-[var(--line-dark)] pt-8" aria-labelledby="communication-structure-title">
        <header className="grid gap-5 border-b border-[var(--line)] pb-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-[11px] font-semibold tracking-[.18em] text-[var(--blue)]">
              比较式书信细读 · {communicationView === "overview" ? "结构纵览" : "研究发现"}
            </p>
            <h2 id="communication-structure-title" className="mt-2 text-[30px] font-semibold tracking-[.06em] text-[var(--ink)] sm:text-[34px]">
              通信行动结构
            </h2>
            <p className="mt-2 max-w-2xl text-[12px] leading-6 text-[var(--muted)]">
              先在棋盘中发现一种写信现象，再决定是否沿着结构进入原文。
            </p>
          </div>
          <nav className="flex items-center gap-6 text-[12px]" aria-label="通信行动结构内部视图">
            <button
              type="button"
              className={`border-0 border-b bg-transparent pb-1 ${communicationView === "overview" ? "border-[var(--blue)] text-[var(--blue)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}
              onClick={() => setCommunicationView("overview")}
              aria-pressed={communicationView === "overview"}
            >
              结构纵览
            </button>
            <button
              type="button"
              className={`border-0 border-b bg-transparent pb-1 ${communicationView === "findings" ? "border-[var(--blue)] text-[var(--blue)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}
              onClick={() => setCommunicationView("findings")}
              aria-pressed={communicationView === "findings"}
            >
              研究发现
            </button>
          </nav>
        </header>

        <div className="pt-7">
          <div hidden={communicationView !== "overview"}>
            <CommunicationAnalysis />
          </div>
          <div hidden={communicationView !== "findings"}>
            <RequestAnalysisView initialType="A" />
          </div>
        </div>
      </section>
    </div>
  );
}
