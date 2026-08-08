"use client";

import FeaturedAnalysis from "./FeaturedAnalysis";
import { FreeAnalysisWorkbench } from "./FreeAnalysisWorkbench";

export function AnalysisPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-[var(--paper)] pb-6 font-serif">
      <div className="site-container">
        <FeaturedAnalysis customContent={<FreeAnalysisWorkbench />} />
      </div>
    </main>
  );
}
