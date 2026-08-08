"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactEChartsCore from "echarts-for-react/esm/core";
import { entityTypeMeta, eventTypeMeta } from "@/lib/config";
import { dataset } from "@/lib/data-adapter";
import { echarts } from "@/lib/analysis/echarts-builder";
import type { ActType, EntityType, EventType } from "@/lib/types";

const START_YEAR = 1894;
const END_YEAR = 1926;
const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, index) => START_YEAR + index);
const ENTITY_ORDER: EntityType[] = ["PER", "LOC", "BOK", "VER", "TIM", "OFF", "ORG", "KIN", "AST"];
const EVENT_ORDER: EventType[] = ["SOC", "BIB", "ACA", "POL", "FAM"];
const ACTION_ORDER: ActType[] = ["AST", "DIR", "EXP", "COM"];

const ACTION_LABELS: Record<ActType, string> = {
  AST: "陈述",
  DIR: "指示",
  EXP: "表达",
  COM: "承诺",
};

const ENTITY_COLORS: Record<EntityType, string> = {
  PER: "#955c56", LOC: "#587086", BOK: "#987b43", VER: "#7a6688", TIM: "#8c6f55",
  OFF: "#686d8f", ORG: "#53777a", KIN: "#986b76", AST: "#4f776b",
};

const ACTION_COLORS: Record<ActType, string> = {
  AST: "#526f67", DIR: "#8f6d5d", EXP: "#6d7185", COM: "#ad9a77",
};

const EVENT_COLORS: Record<EventType, string> = {
  SOC: "#9a6d62", BIB: "#746d91", ACA: "#557985", POL: "#9a845b", FAM: "#668071",
};

type CountCell = { value: number; letterIds: string[] };
type RelationItem = { key: string; label: string; count: number; letterIds: string[]; color: string };

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function percent(value: number, total: number, digits = 0) {
  if (!total) return "0%";
  return `${((value / total) * 100).toFixed(digits)}%`;
}

function makeCell(): CountCell {
  return { value: 0, letterIds: [] };
}

function buildData() {
  const yearCounts = new Map<number, number>(YEARS.map((year) => [year, 0]));
  const recipientCounts = new Map<string, number>();
  const recipientYearCounts = new Map<string, Map<number, number>>();
  const eventCounts = new Map<EventType, number>(EVENT_ORDER.map((type) => [type, 0]));
  const entityEvent = ENTITY_ORDER.map(() => EVENT_ORDER.map(makeCell));
  const eventAction = EVENT_ORDER.map(() => ACTION_ORDER.map(makeCell));

  dataset.letters.forEach((letter) => {
    recipientCounts.set(letter.recipient, (recipientCounts.get(letter.recipient) ?? 0) + 1);
    if (letter.year) {
      const year = Number.parseInt(letter.year, 10);
      if (Number.isFinite(year)) {
        yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
        if (!recipientYearCounts.has(letter.recipient)) recipientYearCounts.set(letter.recipient, new Map());
        const map = recipientYearCounts.get(letter.recipient)!;
        map.set(year, (map.get(year) ?? 0) + 1);
      }
    }

    const entities = dataset.entitiesByLetter[letter.id] ?? [];
    const events = dataset.eventsByLetter[letter.id] ?? [];
    const eventTypeById = new Map(events.map((event) => [event.id, event.type]));
    events.forEach((event) => eventCounts.set(event.type, (eventCounts.get(event.type) ?? 0) + 1));

    entities.forEach((entity) => events.forEach((event) => {
      if (entity.start < 0 || event.start < 0 || entity.start >= event.end || entity.end <= event.start) return;
      const cell = entityEvent[ENTITY_ORDER.indexOf(entity.type)][EVENT_ORDER.indexOf(event.type)];
      cell.value += 1;
      cell.letterIds.push(letter.id);
    }));

    (dataset.actsByLetter?.[letter.id] ?? []).forEach((act) => {
      const actionIndex = ACTION_ORDER.indexOf(act.type);
      if (actionIndex < 0) return;
      act.eventLinks.forEach((link) => {
        const eventType = eventTypeById.get(link.eventId);
        if (!eventType) return;
        const cell = eventAction[EVENT_ORDER.indexOf(eventType)][actionIndex];
        cell.value += 1;
        cell.letterIds.push(letter.id);
      });
    });
  });

  const recipients = [...recipientCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .map(([name, count]) => ({ name, count }));

  return {
    yearCounts,
    recipientCounts,
    recipientYearCounts,
    recipients,
    eventCounts,
    entityEvent,
    eventAction,
    unknownYears: dataset.letters.filter((letter) => !letter.year).length,
  };
}

const DATA = buildData();

function EvidenceLinks({ letterIds }: { letterIds: string[] }) {
  const ids = unique(letterIds).slice(0, 3);
  return ids.length ? (
    <div className="flex flex-wrap gap-5">
      {ids.map((id, index) => (
        <Link className="border-b border-[var(--line-dark)] pb-1.5 text-[11px] text-[var(--ink)] transition hover:border-[var(--blue)] hover:text-[var(--blue)]" href={`/letter/${encodeURIComponent(id)}`} key={id}>
          代表原信 {index + 1} ↗
        </Link>
      ))}
    </div>
  ) : <span className="text-[11px] text-[var(--muted)]">选择一项关系后查看代表原信</span>;
}

export function CollectionSummaryMetrics() {
  return (
    <div className="grid grid-cols-2 border-b border-[var(--line)] py-5 lg:grid-cols-4">
      {[
        ["306", "封书信"],
        ["58", "位通信对象"],
        ["1894—1926", "书信时间范围"],
        ["230", "封年代明确"],
      ].map(([value, label], index) => (
        <div className={`px-3 text-center ${index > 0 ? "lg:border-l lg:border-[var(--line)]" : ""}`} key={label}>
          <strong className="block text-[22px] font-normal tracking-[.04em] text-[var(--ink)] sm:text-[25px]">{value}</strong>
          <span className="mt-1 block text-[10px] text-[var(--muted)]">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function CorpusOverviewContent({ pageIndex }: { pageIndex?: 0 | 1 }) {
  const showPage = pageIndex ?? null; // null means show all (standalone page)
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [lockedYear, setLockedYear] = useState<number | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventType>("BIB");
  const [lockedRelation, setLockedRelation] = useState<RelationItem | null>(null);
  const activeYear = lockedYear ?? hoverYear;
  const activeRelation = lockedRelation;

  const scopeLetters = useMemo(
    () => activeYear ? dataset.letters.filter((letter) => Number.parseInt(letter.year ?? "", 10) === activeYear) : dataset.letters,
    [activeYear],
  );

  const rankedRecipients = useMemo(() => {
    const counts = new Map<string, number>();
    scopeLetters.forEach((letter) => counts.set(letter.recipient, (counts.get(letter.recipient) ?? 0) + 1));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
      .slice(0, 7)
      .map(([name, count]) => ({ name, count }));
  }, [scopeLetters]);

  const trendOption = useMemo(() => {
    const allCounts = YEARS.map((year) => DATA.yearCounts.get(year) ?? 0);
    const recipientCounts = selectedRecipient
      ? YEARS.map((year) => DATA.recipientYearCounts.get(selectedRecipient)?.get(year) ?? 0)
      : [];
    // Hover only updates the linked recipient list. Keeping it out of the
    // chart option prevents ECharts from replacing series during mousemove.
    const focusYear = lockedYear;
    const focusIndex = focusYear ? YEARS.indexOf(focusYear) : -1;
    const series: object[] = [
      {
        name: "全部书信",
        type: "line",
        data: allCounts,
        smooth: 0.18,
        smoothMonotone: "x",
        showSymbol: false,
        lineStyle: { color: "#9a7c45", width: 1.8 },
        areaStyle: { color: "rgba(154,124,69,.09)" },
        emphasis: { disabled: true },
        z: 2,
      },
      {
        name: "交互捕获",
        type: "scatter",
        data: allCounts,
        symbolSize: 22,
        itemStyle: { color: "rgba(0,0,0,0)" },
        tooltip: { show: false },
        z: 4,
      },
    ];
    if (selectedRecipient) {
      series.push({
        name: `致${selectedRecipient}`,
        type: "line",
        data: recipientCounts,
        smooth: 0.18,
        smoothMonotone: "x",
        showSymbol: false,
        lineStyle: { color: "#526b80", width: 2 },
        areaStyle: { color: "rgba(82,107,128,.055)" },
        z: 3,
      });
    }
    if (focusIndex >= 0) {
      series.push({
        name: "当前年份",
        type: "scatter",
        data: allCounts.map((value, index) => index === focusIndex ? value : null),
        symbolSize: 8,
        itemStyle: { color: "#9a7c45", borderColor: "#f8f6f0", borderWidth: 2 },
        tooltip: { show: false },
        z: 5,
      });
    }
    return {
      animationDuration: 420,
      textStyle: { fontFamily: '"Noto Serif SC", "Songti SC", STSong, SimSun, serif' },
      grid: { left: 30, right: 8, top: 38, bottom: 68, containLabel: false },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255,254,249,.98)",
        borderColor: "#cfc8ba",
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: "#27242a", fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: "#b3a98f", width: 1, type: "dashed" } },
        formatter: (raw: unknown) => {
          const params = raw as Array<{ axisValue: string; seriesName: string; data: number }>;
          const visible = params.filter((item) => item.seriesName !== "交互捕获" && item.seriesName !== "当前年份" && item.data !== null);
          return `<div style="font-family:serif"><b>${params[0]?.axisValue}年</b>${visible.map((item) => `<div style="margin-top:4px">${item.seriesName}：${item.data}封</div>`).join("")}</div>`;
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: YEARS.map(String),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#625d63", fontSize: 11, interval: 4, margin: 16 },
      },
      yAxis: { type: "value", show: false, min: 0, max: Math.ceil(Math.max(...allCounts) * 1.35) },
      series,
    };
  }, [lockedYear, selectedRecipient]);

  const letterTicks = useMemo(() => {
    return dataset.letters.flatMap((letter) => {
      if (!letter.year) return [];
      const year = Number.parseInt(letter.year, 10);
      if (year < START_YEAR || year > END_YEAR) return [];
      const yearLetters = dataset.letters.filter((item) => item.year === letter.year);
      const index = yearLetters.findIndex((item) => item.id === letter.id);
      const spread = yearLetters.length > 1 ? (index + 0.5) / yearLetters.length - 0.5 : 0;
      const left = ((year - START_YEAR + spread * 0.72) / (END_YEAR - START_YEAR)) * 100;
      return [{ id: letter.id, year, recipient: letter.recipient, left, height: 5 + (index % 4) * 2 }];
    });
  }, []);

  const relationItems = useMemo(() => {
    const eventIndex = EVENT_ORDER.indexOf(selectedEvent);
    const entities: RelationItem[] = ENTITY_ORDER.map((type, entityIndex) => {
      const cell = DATA.entityEvent[entityIndex][eventIndex];
      return { key: `entity-${type}`, label: entityTypeMeta[type].label, count: cell.value, letterIds: cell.letterIds, color: ENTITY_COLORS[type] };
    });
    const actions: RelationItem[] = ACTION_ORDER.map((type, actionIndex) => {
      const cell = DATA.eventAction[eventIndex][actionIndex];
      return { key: `action-${type}`, label: ACTION_LABELS[type], count: cell.value, letterIds: cell.letterIds, color: ACTION_COLORS[type] };
    });
    return { entities, actions };
  }, [selectedEvent]);

  const entityChartItems = useMemo(() => relationItems.entities.filter((item) => item.count > 0), [relationItems]);
  const actionChartItems = useMemo(() => relationItems.actions.filter((item) => item.count > 0), [relationItems]);
  const entityTotal = entityChartItems.reduce((sum, item) => sum + item.count, 0);
  const actionTotal = actionChartItems.reduce((sum, item) => sum + item.count, 0);
  const leadingEntity = [...entityChartItems].sort((a, b) => b.count - a.count)[0];
  const leadingAction = [...actionChartItems].sort((a, b) => b.count - a.count)[0];

  const entityOption = useMemo(() => ({
    animationDuration: 520,
    textStyle: { fontFamily: '"Noto Serif SC", "Songti SC", STSong, SimSun, serif' },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(255,254,249,.98)",
      borderColor: "#cfc8ba",
      textStyle: { color: "#27242a", fontSize: 12 },
      formatter: (raw: unknown) => {
        const item = raw as { name: string; value: number; dataIndex: number };
        if (item.dataIndex >= entityChartItems.length) return "";
        return `${item.name}<br/>${item.value}次 · ${percent(item.value, entityTotal, 1)}`;
      },
    },
    series: [{
      name: "实体构成",
      type: "pie",
      center: ["46%", "76%"],
      radius: [64, 114],
      startAngle: 180,
      clockwise: true,
      avoidLabelOverlap: true,
      selectedMode: "single",
      itemStyle: { borderColor: "#f8f6f0", borderWidth: 2 },
      label: {
        color: "#59545a",
        fontSize: 10,
        formatter: (raw: { name: string; value: number; dataIndex: number }) => raw.dataIndex < entityChartItems.length ? raw.name : "",
      },
      labelLine: { length: 20, length2: 12, lineStyle: { color: "#b9b1a4" } },
      emphasis: { scaleSize: 5, itemStyle: { shadowBlur: 12, shadowColor: "rgba(39,36,42,.12)" } },
      data: [
        ...entityChartItems.map((item) => ({ name: item.label, value: item.count, itemStyle: { color: item.color } })),
        { name: "", value: entityTotal, tooltip: { show: false }, label: { show: false }, labelLine: { show: false }, itemStyle: { color: "transparent", borderWidth: 0 }, emphasis: { disabled: true } },
      ],
    }],
  }), [entityChartItems, entityTotal]);

  const actionOption = useMemo(() => ({
    animationDuration: 520,
    textStyle: { fontFamily: '"Noto Serif SC", "Songti SC", STSong, SimSun, serif' },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(255,254,249,.98)",
      borderColor: "#cfc8ba",
      textStyle: { color: "#27242a", fontSize: 12 },
      formatter: (raw: unknown) => {
        const item = raw as { name: string; value: number };
        return `${item.name}<br/>${item.value}次 · ${percent(item.value, actionTotal, 1)}`;
      },
    },
    polar: { center: ["50%", "52%"], radius: "67%" },
    angleAxis: {
      type: "category",
      data: actionChartItems.map((item) => item.label),
      startAngle: 90,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#4f4a50", fontSize: 12, margin: 14 },
    },
    radiusAxis: {
      type: "value",
      max: Math.max(...actionChartItems.map((item) => item.count), 1) * 1.12,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitNumber: 4,
      splitLine: { lineStyle: { color: ["rgba(39,36,42,.08)"], type: "dashed" } },
      splitArea: { show: false },
    },
    series: [{
      name: "沟通行动",
      type: "bar",
      coordinateSystem: "polar",
      roundCap: true,
      barWidth: "54%",
      data: actionChartItems.map((item) => ({ name: item.label, value: item.count, itemStyle: { color: item.color, opacity: .88 } })),
      emphasis: { focus: "self", itemStyle: { opacity: 1, shadowBlur: 10, shadowColor: "rgba(39,36,42,.12)" } },
    }],
  }), [actionChartItems, actionTotal]);

  const relationTotal = activeRelation?.key.startsWith("entity-")
    ? relationItems.entities.reduce((sum, item) => sum + item.count, 0)
    : relationItems.actions.reduce((sum, item) => sum + item.count, 0);

  const handleYearEvent = (params: { dataIndex?: number }) => {
    if (typeof params.dataIndex === "number") setHoverYear(YEARS[params.dataIndex]);
  };

  return (
    <div>
        {(showPage === null || showPage === 0) && (
        <>
          <section className="scroll-mt-20 py-7" id="materials">
            <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
              <article>
                <header className="flex flex-wrap items-end justify-between gap-4">
                  <div><p className="text-[10px] tracking-[.13em] text-[var(--muted)]">横轴为公历年代</p><h2 className="mt-2 border-l-2 border-[var(--gold)] pl-3 text-[22px]">年代分布</h2></div>
                  <div className="flex items-center gap-4 text-[11px] text-[var(--muted)]">
                    {selectedRecipient ? <button type="button" className="border-b border-[var(--blue)] pb-1 text-[var(--blue)]" onClick={() => setSelectedRecipient(null)}>已突出：致{selectedRecipient} ×</button> : <span>点击右侧人名叠加其年代曲线</span>}
                    {lockedYear ? <button type="button" className="border-b border-[var(--gold)] pb-1 text-[var(--gold)]" onClick={() => setLockedYear(null)}>已锁定 {lockedYear}年 ×</button> : null}
                  </div>
                </header>
                <div className="relative mt-2 h-[440px] min-w-0">
                  <ReactEChartsCore
                    echarts={echarts}
                    option={trendOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge={false}
                    lazyUpdate
                    opts={{ renderer: "canvas" }}
                    onEvents={{
                      mouseover: handleYearEvent,
                      globalout: () => setHoverYear(null),
                      click: (params: { dataIndex?: number }) => {
                        if (typeof params.dataIndex === "number") setLockedYear(YEARS[params.dataIndex]);
                      },
                    }}
                  />
                  <div className="pointer-events-none absolute bottom-[68px] left-[30px] right-[8px] h-5 border-b border-[var(--line-dark)]" aria-label="逐封书信年代刻度">
                    {letterTicks.map((tick) => (
                      <Link
                        className={`pointer-events-auto absolute bottom-0 w-px -translate-x-1/2 transition hover:w-[2px] ${selectedRecipient && tick.recipient !== selectedRecipient ? "bg-[var(--line)] opacity-30" : selectedRecipient ? "bg-[var(--blue)]" : "bg-[var(--gold)] opacity-65"}`}
                        href={`/letter/${encodeURIComponent(tick.id)}`}
                        key={tick.id}
                        style={{ left: `${tick.left}%`, height: tick.height }}
                        title={`${tick.year}年 · 致${tick.recipient}`}
                        aria-label={`${tick.year}年致${tick.recipient}的书信`}
                      />
                    ))}
                  </div>
                </div>
              </article>

              <aside>
                <header className="flex items-end justify-between border-b border-[var(--line)] pb-4">
                  <div><p className="text-[10px] tracking-[.13em] text-[var(--muted)]">{activeYear ? `${activeYear}年` : "全部年代"}</p><h2 className="mt-2 border-l-2 border-[var(--gold)] pl-3 text-[22px]">主要通信对象</h2></div>
                  <span className="text-[11px] text-[var(--muted)]">{scopeLetters.length}封</span>
                </header>
                <div className="grid grid-cols-[minmax(0,1fr)_56px_60px] border-b border-[var(--line)] py-3 text-[10px] text-[var(--muted)] lg:grid-cols-[minmax(180px,1fr)_90px_100px]"><span>通信对象</span><span className="text-right">封数</span><span className="text-right">占比</span></div>
                <div>
                  {rankedRecipients.map((recipient) => {
                    const active = selectedRecipient === recipient.name;
                    return (
                      <button type="button" className={`grid min-h-[48px] w-full grid-cols-[minmax(0,1fr)_56px_60px] items-center border-b border-[var(--line)] px-2 text-left transition lg:grid-cols-[minmax(180px,1fr)_90px_100px] ${active ? "bg-[rgba(82,107,128,.08)]" : "hover:bg-[rgba(255,254,249,.72)]"}`} key={recipient.name} onClick={() => setSelectedRecipient(active ? null : recipient.name)}>
                        <span className={`text-[14px] ${active ? "text-[var(--blue)]" : ""}`}>{recipient.name}</span><span className="text-right text-[12px] tabular-nums">{recipient.count}</span><span className="text-right text-[11px] tabular-nums text-[var(--muted)]">{percent(recipient.count, scopeLetters.length, 1)}</span>
                      </button>
                    );
                  })}
                </div>
                {!activeYear ? <div className="mt-3 flex items-baseline justify-between border-b border-[var(--line-dark)] px-2 py-3"><span className="text-[13px] text-[var(--muted)]">年代未详</span><span className="text-[12px] tabular-nums">{DATA.unknownYears}<small className="ml-3 text-[10px] text-[var(--muted)]">{percent(DATA.unknownYears, dataset.letters.length, 1)}</small></span></div> : null}
              </aside>
            </div>
            <footer className="mt-7 grid gap-4 border-t border-[var(--line-dark)] pt-5 md:grid-cols-[1fr_auto] md:items-center">
              <p className="text-[12px] leading-7 text-[var(--muted)]"><span className="mr-2 text-[var(--blue)]">图示说明：</span>曲线表示各年现存书信数量，每条短刻度代表一封书信；悬停年份可联动右侧通信对象。</p>
              <details className="text-[11px] text-[var(--muted)]"><summary className="cursor-pointer border-b border-[var(--line-dark)] pb-1">查看数据口径</summary><p className="mt-3 max-w-sm leading-6">仅统计网站当前收录书信；年代未详材料不进入曲线。</p></details>
            </footer>
          </section>
        </>
        )}

        {(showPage === null || showPage === 1) && (
        <>
          <section className="scroll-mt-20 border-t border-[var(--line-dark)] py-9" id="relations">
            <header className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-[10px] tracking-[.13em] text-[var(--muted)]">从材料进入关系</p>
                <h2 className="mt-2 text-[24px] tracking-[.04em]">这些书信谈论什么，又如何表达？</h2>
                <p className="mt-3 max-w-2xl text-[12px] leading-7 text-[var(--muted)]">选择一种事务，左侧观察其实体环境，右侧观察叶德辉采用的沟通行动。两边分别计算，不表示实体与行动之间存在直接流向。</p>
              </div>
              <span className="text-[11px] text-[var(--muted)]">悬停看数字 · 点击锁定证据</span>
            </header>

            <div className="mt-7 grid grid-cols-2 border-y border-[var(--line)] sm:grid-cols-5" role="tablist" aria-label="事务类别">
              {EVENT_ORDER.map((type, index) => {
                const active = selectedEvent === type;
                return (
                  <button
                    type="button"
                    className={`group min-h-[76px] border-b px-4 py-4 text-left transition sm:border-b-0 ${index < EVENT_ORDER.length - 1 ? "sm:border-r" : ""} ${active ? "bg-[rgba(255,254,249,.7)] text-[var(--ink)]" : "text-[var(--muted)] hover:bg-[rgba(255,254,249,.45)] hover:text-[var(--ink)]"}`}
                    style={{ borderColor: "var(--line)" }}
                    key={type}
                    onClick={() => { setSelectedEvent(type); setLockedRelation(null); }}
                    role="tab"
                    aria-selected={active}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-[14px]">{eventTypeMeta[type].label}</span>
                      <small className="text-[10px] tabular-nums">{DATA.eventCounts.get(type)}</small>
                    </span>
                    <i className="mt-4 block h-px transition-all duration-300" style={{ width: active ? "100%" : "26%", background: EVENT_COLORS[type] }} />
                  </button>
                );
              })}
            </div>

            <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-2">
              <article className="order-1 min-w-0 border-y border-[var(--line)] py-5">
                <header className="flex items-end justify-between px-2">
                  <div><p className="text-[10px] tracking-[.12em] text-[var(--muted)]">这类事务涉及什么</p><h3 className="mt-1 text-[19px]">实体构成</h3></div>
                  <span className="text-[10px] tabular-nums text-[var(--muted)]">{entityTotal}次关联</span>
                </header>
                <div className="h-[330px] min-w-0 overflow-visible">
                  <ReactEChartsCore
                    echarts={echarts}
                    option={entityOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge={false}
                    lazyUpdate
                    opts={{ renderer: "canvas" }}
                    onEvents={{
                      click: (params: { dataIndex?: number }) => {
                        if (typeof params.dataIndex !== "number") return;
                        const item = entityChartItems[params.dataIndex];
                        if (item) setLockedRelation(lockedRelation?.key === item.key ? null : item);
                      },
                    }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-x-4 gap-y-2 px-2 sm:grid-cols-5">
                  {entityChartItems.map((item) => <button type="button" className={`grid grid-cols-[6px_1fr_auto] items-center gap-2 border-b pb-2 text-left text-[10px] ${activeRelation?.key === item.key ? "border-[var(--ink)] text-[var(--ink)]" : "border-[var(--line)] text-[var(--muted)]"}`} key={item.key} onClick={() => setLockedRelation(activeRelation?.key === item.key ? null : item)}><i className="size-1" style={{ background: item.color }} /><span>{item.label}</span><span>{item.count}</span></button>)}
                </div>
              </article>

              <aside className="order-3 flex min-h-[112px] flex-col items-center justify-center border-y border-[var(--line)] px-5 py-5 text-center lg:col-span-2 lg:flex-row lg:gap-7 lg:text-left">
                <p className="text-[10px] tracking-[.14em] text-[var(--muted)]">当前事务</p>
                <div className="my-3 flex size-24 shrink-0 flex-col items-center justify-center rounded-full border border-[var(--line-dark)] bg-[rgba(255,254,249,.45)] lg:my-0">
                  <strong className="text-[19px] font-normal" style={{ color: EVENT_COLORS[selectedEvent] }}>{eventTypeMeta[selectedEvent].label}</strong>
                  <span className="mt-2 text-[10px] text-[var(--muted)]">{DATA.eventCounts.get(selectedEvent)}段</span>
                </div>
                <p className="max-w-xl text-[13px] leading-7 text-[var(--muted)]">以<span className="mx-1 text-[var(--ink)]">{leadingEntity?.label}</span>关联最多，沟通行动以<span className="mx-1 text-[var(--ink)]">{leadingAction?.label}</span>为主。</p>
              </aside>

              <article className="order-2 min-w-0 border-y border-[var(--line)] py-5">
                <header className="flex items-end justify-between px-2">
                  <div><p className="text-[10px] tracking-[.12em] text-[var(--muted)]">这类事务如何表达</p><h3 className="mt-1 text-[19px]">内容行动</h3></div>
                  <span className="text-[10px] tabular-nums text-[var(--muted)]">{actionTotal}次关联</span>
                </header>
                <div className="h-[350px] min-w-0">
                  <ReactEChartsCore
                    echarts={echarts}
                    option={actionOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge={false}
                    lazyUpdate
                    opts={{ renderer: "canvas" }}
                    onEvents={{
                      click: (params: { dataIndex?: number }) => {
                        if (typeof params.dataIndex !== "number") return;
                        const item = actionChartItems[params.dataIndex];
                        if (item) setLockedRelation(lockedRelation?.key === item.key ? null : item);
                      },
                    }}
                  />
                </div>
              </article>
            </div>

            <aside className={`mt-7 grid min-h-[112px] gap-6 border-y px-6 py-6 transition-colors md:grid-cols-[1fr_auto] md:items-center ${activeRelation ? "border-[rgba(82,107,128,.45)] bg-[rgba(82,107,128,.055)]" : "border-[var(--line-dark)] bg-[rgba(255,254,249,.35)]"}`} aria-live="polite">
              <div>
                <p className={`text-[10px] tracking-[.12em] ${activeRelation ? "text-[var(--blue)]" : "text-[var(--muted)]"}`}>{activeRelation ? "已锁定关系 · 可返回原信核查" : "证据入口"}</p>
                {activeRelation ? <p className="mt-3 text-[19px]">{eventTypeMeta[selectedEvent].label} × {activeRelation.label}<span className="ml-5 text-[12px] text-[var(--muted)]">{activeRelation.count}次 · {percent(activeRelation.count, relationTotal, 1)}</span><button type="button" className="ml-5 text-[11px] text-[var(--muted)] hover:text-[var(--ink)]" onClick={() => setLockedRelation(null)}>取消 ×</button></p> : <p className="mt-3 text-[13px] leading-6 text-[var(--muted)]">悬停图形查看精确比例，点击任一扇区后连接代表原信。</p>}
              </div>
              <EvidenceLinks letterIds={activeRelation?.letterIds ?? []} />
            </aside>

            <details className="mt-5 border-t border-dashed border-[var(--line)] pt-4 text-[11px] text-[var(--muted)]">
              <summary className="w-fit cursor-pointer border-b border-[var(--line-dark)] pb-1">查看精确数据</summary>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <p className="leading-6">实体：{relationItems.entities.map((item) => `${item.label} ${item.count}`).join("、")}</p>
                <p className="leading-6">行动：{relationItems.actions.map((item) => `${item.label} ${item.count}`).join("、")}</p>
              </div>
            </details>
          </section>
        </>
        )}
      </div>
  );
}

type CollectionSubView = "overview" | "relation";

export function CollectionMainView() {
  const [activeSubView, setActiveSubView] = useState<CollectionSubView>("overview");
  const [phase, setPhase] = useState<"idle" | "leaving" | "entering">("idle");
  const [direction, setDirection] = useState<"left" | "right">("left");
  const touchStartX = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const switchSubView = useCallback((next: CollectionSubView) => {
    if (next === activeSubView || phase !== "idle") return;
    const nextDirection = next === "relation" ? "left" : "right";
    setDirection(nextDirection);
    setPhase("leaving");
    const swapTimer = window.setTimeout(() => {
      setActiveSubView(next);
      setPhase("entering");
      contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const settleTimer = window.setTimeout(() => {
        setPhase("idle");
        window.dispatchEvent(new Event("resize"));
      }, 40);
      timers.current.push(settleTimer);
    }, 150);
    timers.current.push(swapTimer);
  }, [activeSubView, phase]);

  const motionClass = phase === "leaving"
    ? direction === "left" ? "-translate-x-7 opacity-0" : "translate-x-7 opacity-0"
    : phase === "entering"
      ? direction === "left" ? "translate-x-7 opacity-0" : "-translate-x-7 opacity-0"
      : "translate-x-0 opacity-100";

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    event.stopPropagation();
    if (event.key === "ArrowRight" && activeSubView === "overview") switchSubView("relation");
    if (event.key === "ArrowLeft" && activeSubView === "relation") switchSubView("overview");
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 54) return;
    if (distance < 0 && activeSubView === "overview") switchSubView("relation");
    if (distance > 0 && activeSubView === "relation") switchSubView("overview");
  };

  return (
    <div className="min-w-0" ref={contentRef}>
      <CollectionSummaryMetrics />
      <nav className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--line)] py-4 text-[11px]" aria-label="书信收录问题内部视图">
        <button
          type="button"
          className={`justify-self-start border-0 bg-transparent text-left ${activeSubView === "overview" ? "invisible" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
          onClick={() => switchSubView("overview")}
          disabled={activeSubView === "overview" || phase !== "idle"}
        >
          ← 材料概况
        </button>
        <span className="tracking-[.12em] text-[var(--ink)]">{activeSubView === "overview" ? "材料概况" : "关系与表达"}</span>
        <button
          type="button"
          className={`justify-self-end border-0 bg-transparent text-right ${activeSubView === "relation" ? "invisible" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
          onClick={() => switchSubView("relation")}
          disabled={activeSubView === "relation" || phase !== "idle"}
        >
          关系与表达 →
        </button>
      </nav>
      <div
        className={`min-w-0 transition-[opacity,transform] duration-[260ms] ease-out ${motionClass}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onTouchStart={(event) => { event.stopPropagation(); touchStartX.current = event.touches[0].clientX; }}
        onTouchEnd={handleTouchEnd}
      >
        <CorpusOverviewContent pageIndex={activeSubView === "overview" ? 0 : 1} />
      </div>
    </div>
  );
}

export function CorpusOverviewPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-[var(--paper)] pb-8 font-serif">
      <div className="site-container">
        <CollectionMainView />
      </div>
    </main>
  );
}
