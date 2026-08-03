"use client";

import { useCallback, useState } from "react";
import { computePivot, flattenPivot } from "@/lib/analysis/aggregator";
import { dataset } from "@/lib/data-adapter";
import type { AnalysisConfig, ChartType, PivotResult } from "@/lib/analysis/types";
import { ChartPanel } from "./ChartPanel";
import { DimensionPanel } from "./DimensionPanel";
import FeaturedAnalysis, { ResearchDrawerShell } from "./FeaturedAnalysis";
import { PivotTable } from "./PivotTable";

const UNKNOWN_YEAR_COUNT = dataset.letters.filter((letter) => !letter.year).length;

const DEFAULT_CONFIG: AnalysisConfig = {
  selectedDimensions: [],
  rowKey: null,
  columnKey: "year",
  metric: "mention_count",
  filters: [],
  chartType: "line",
  excludeUnknownYear: false,
};

interface AnalysisRun {
  config: AnalysisConfig;
  result: PivotResult;
}

function cloneConfig(config: AnalysisConfig): AnalysisConfig {
  return {
    ...config,
    selectedDimensions: [...config.selectedDimensions],
    filters: config.filters.map((filter) => ({
      ...filter,
      value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
    })),
  };
}

function flatColumnLabels(config: AnalysisConfig, result: PivotResult): string[] {
  if (!config.columnKey) return ["总计"];
  return result.columnHeaders.flatMap((header) =>
    header.children?.map((child) => `${header.label} · ${child.label}`) ?? [header.label],
  );
}

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function AnalysisPage() {
  const [customOpen, setCustomOpen] = useState(false);
  const [config, setConfig] = useState<AnalysisConfig>(() => cloneConfig(DEFAULT_CONFIG));
  const [analysis, setAnalysis] = useState<AnalysisRun | null>(null);
  const [cacheEpoch, setCacheEpoch] = useState(0);
  const [exportStatus, setExportStatus] = useState("");

  const runAnalysis = useCallback((nextConfig: AnalysisConfig) => {
    const snapshot = cloneConfig(nextConfig);
    setConfig(snapshot);
    setAnalysis({ config: snapshot, result: computePivot(snapshot, dataset) });
    setExportStatus("");
    window.requestAnimationFrame(() => {
      document.getElementById("custom-analysis-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleChartTypeChange = useCallback((chartType: ChartType) => {
    setConfig((current) => ({ ...current, chartType }));
    setAnalysis((current) => current ? { ...current, config: { ...current.config, chartType } } : null);
  }, []);

  const handleReset = useCallback(() => {
    setConfig(cloneConfig(DEFAULT_CONFIG));
    setAnalysis(null);
    setCacheEpoch((current) => current + 1);
    setExportStatus("");
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!analysis) return;
    const rows = flattenPivot(analysis.result);
    const columnLabels = flatColumnLabels(analysis.config, analysis.result);
    const hasNestedRows = rows.some((row) => row.subLabel !== null);
    const header = [...(hasNestedRows ? ["主维度", "子维度"] : ["维度"]), ...columnLabels, "合计"];
    const body = rows.map((row) => [row.mainLabel, ...(hasNestedRows ? [row.subLabel ?? ""] : []), ...row.values, row.total]);
    const total = ["合计", ...(hasNestedRows ? [""] : []), ...analysis.result.columnTotals, analysis.result.grandTotal];
    const csv = [header, ...body, total].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "叶德辉书信_问题研究_自定义分析.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setExportStatus("CSV 已导出");
    window.setTimeout(() => setExportStatus(""), 1800);
  }, [analysis]);

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[var(--paper)] pb-6 font-serif">
      <div className="site-container">
        <FeaturedAnalysis onOpenCustom={() => setCustomOpen(true)} />
      </div>

      {customOpen ? (
        <ResearchDrawerShell label="自定义分析" onClose={() => setCustomOpen(false)} wide>
          <header className="sticky top-0 z-20 flex items-start justify-between gap-5 border-b border-[var(--line-dark)] bg-[var(--paper)] px-6 py-5 sm:px-8">
            <div><p className="text-[9px] tracking-[.16em] text-[var(--purple)]">辅助研究工具</p><h2 className="mt-2 text-[24px] font-normal">自定义分析</h2><p className="mt-1 text-[10px] text-[var(--muted)]">当前问题与分析视图会在关闭后原样保留</p></div>
            <div className="flex items-center gap-2"><button type="button" className="h-9 border border-[var(--line)] px-3 text-[10px]" onClick={handleReset}>重置</button><button type="button" className="grid size-9 place-items-center border border-[var(--line)] text-[18px]" onClick={() => setCustomOpen(false)} aria-label="关闭自定义分析">×</button></div>
          </header>
          <div className="px-6 py-6 sm:px-8">
            <DimensionPanel config={config} onChange={setConfig} onAnalyze={() => runAnalysis(config)} unknownYearCount={UNKNOWN_YEAR_COUNT} cacheEpoch={cacheEpoch} />

            {analysis ? (
              <section className="scroll-mt-24 pt-8" id="custom-analysis-result">
                <header className="mb-4 border-b border-[var(--line-dark)] pb-3"><p className="text-[9px] tracking-[.14em] text-[var(--purple)]">生成结果</p><h3 className="mt-1 text-[20px]">自定义数据视图</h3></header>
                <div className="h-[520px] min-w-0"><ChartPanel result={analysis.result} config={analysis.config} loading={false} onChartTypeChange={handleChartTypeChange} /></div>
                <div className="mt-6 h-[520px] min-w-0"><PivotTable result={analysis.result} config={analysis.config} loading={false} onExportCsv={handleExportCsv} exportStatus={exportStatus} /></div>
              </section>
            ) : null}
          </div>
        </ResearchDrawerShell>
      ) : null}
    </main>
  );
}
