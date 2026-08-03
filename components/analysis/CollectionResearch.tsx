"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ReactEChartsCore from "echarts-for-react/esm/core";
import { echarts } from "@/lib/analysis/echarts-builder";
import { entityTypeMeta, eventTypeMeta } from "@/lib/config";
import { dataset } from "@/lib/data-adapter";
import type { ActType, EntityType, EventType, Letter } from "@/lib/types";
import { ResearchCarousel } from "./ResearchCarousel";

const START_YEAR = 1894;
const END_YEAR = 1926;
const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, index) => START_YEAR + index);
const EVENT_ORDER: EventType[] = ["SOC", "BIB", "ACA", "POL", "FAM"];
const ENTITY_ORDER: EntityType[] = ["PER", "LOC", "BOK", "VER", "TIM", "OFF", "ORG", "KIN", "AST"];
const ACTION_ORDER: ActType[] = ["INF", "PRS", "MNT", "REQ", "DSP", "NEG"];
const VIEW_LABELS = ["主题与实体构成", "内容行动", "年代分布", "主要通信对象"] as const;

const ACTION_LABELS: Record<ActType, string> = {
  INF: "告知",
  PRS: "赞扬与评价",
  MNT: "关系维系",
  REQ: "请求",
  DSP: "展示与说明",
  NEG: "协商",
  INS: "训导",
};

const ACTION_DESCRIPTIONS: Record<ActType, string> = {
  INF: "交代事实、进展与通信背景，是书信中最常见的行动。",
  PRS: "通过称许、评价或论议推进判断，也为请求建立语境。",
  MNT: "以问候、关切与关系维护延续通信往来。",
  REQ: "请托、询问或要求对方采取具体行动。",
  DSP: "展示材料、书籍、成果或对事实的进一步说明。",
  NEG: "协商处理方式、条件与行动时机。",
  INS: "给出指示、规劝或行动安排。",
};

const EVENT_COLORS: Record<EventType, string> = {
  SOC: "#9a6d62",
  BIB: "#746d91",
  ACA: "#557985",
  POL: "#9a845b",
  FAM: "#668071",
};

const ENTITY_COLORS: Record<EntityType, string> = {
  PER: "#955c56", LOC: "#587086", BOK: "#987b43", VER: "#7a6688", TIM: "#8c6f55",
  OFF: "#686d8f", ORG: "#53777a", KIN: "#986b76", AST: "#4f776b",
};

const ACTION_COLORS: Record<ActType, string> = {
  INF: "#526f67", PRS: "#799087", MNT: "#a2afa7", REQ: "#8f6d5d", DSP: "#6d7185", NEG: "#ad9a77", INS: "#8e8173",
};

const letterMap = new Map(dataset.letters.map((letter) => [letter.id, letter]));

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function percent(value: number, total: number, digits = 1) {
  return total ? `${(value / total * 100).toFixed(digits)}%` : "0%";
}

function cleanText(text: string | null | undefined, max = 72) {
  const value = (text ?? "").replace(/\s+/g, "");
  if (!value) return "原文暂缺";
  return value.length > max ? `${value.slice(0, max)}……` : value;
}

function letterHref(letter: Letter) {
  return `/letter/${encodeURIComponent(letter.id)}`;
}

function buildCollectionData() {
  const yearCounts = new Map<number, number>(YEARS.map((year) => [year, 0]));
  const recipients = new Map<string, string[]>();
  const events = new Map<EventType, { count: number; letterIds: string[] }>(EVENT_ORDER.map((type) => [type, { count: 0, letterIds: [] }]));
  const actions = new Map<ActType, { count: number; letterIds: string[] }>(ACTION_ORDER.map((type) => [type, { count: 0, letterIds: [] }]));

  dataset.letters.forEach((letter) => {
    const year = Number.parseInt(letter.year ?? "", 10);
    if (year >= START_YEAR && year <= END_YEAR) yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
    recipients.set(letter.recipient, [...(recipients.get(letter.recipient) ?? []), letter.id]);
    (dataset.eventsByLetter[letter.id] ?? []).forEach((event) => {
      const item = events.get(event.type)!;
      item.count += 1;
      item.letterIds.push(letter.id);
    });
    (dataset.actsByLetter[letter.id] ?? []).forEach((act) => {
      if (!actions.has(act.type)) actions.set(act.type, { count: 0, letterIds: [] });
      const item = actions.get(act.type)!;
      item.count += 1;
      item.letterIds.push(letter.id);
    });
  });

  const recipientRows = [...recipients.entries()]
    .map(([name, letterIds]) => ({ name, letterIds, count: letterIds.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));

  return { yearCounts, recipients, recipientRows, events, actions };
}

const DATA = buildCollectionData();
const KNOWN_YEAR_COUNT = dataset.letters.filter((letter) => {
  const year = Number.parseInt(letter.year ?? "", 10);
  return year >= START_YEAR && year <= END_YEAR;
}).length;

function dominantEvent(letterIds: string[]) {
  const counts = new Map<EventType, number>(EVENT_ORDER.map((type) => [type, 0]));
  letterIds.forEach((id) => (dataset.eventsByLetter[id] ?? []).forEach((event) => counts.set(event.type, (counts.get(event.type) ?? 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "SOC";
}

function representativeLetter(letterIds: string[]) {
  return letterIds.map((id) => letterMap.get(id)).find((letter): letter is Letter => Boolean(letter)) ?? dataset.letters[0];
}

function CollectionSummary() {
  const recipientCount = new Set(dataset.letters.map((letter) => letter.recipient)).size;
  return (
    <section className="grid gap-6 border-b border-[var(--line)] py-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(420px,.8fr)] lg:items-center">
      <div>
        <p className="text-[10px] font-semibold tracking-[.18em] text-[var(--purple)]">研究发现</p>
        <p className="mt-2 max-w-[790px] text-[16px] leading-8 text-[var(--ink)] sm:text-[18px] sm:leading-8">
          这批书信覆盖叶德辉晚年较长时间跨度，通信对象以学者、藏书家和地方文化人物为主。内容涉及<strong className="font-semibold text-[var(--purple-deep)]">书籍、版本、金石与学术考证</strong>，也包含请托、告知、讨论、评价和关系维系等多种通信行动。
        </p>
      </div>
      <dl className="grid grid-cols-2 border-y border-[var(--line)] lg:grid-cols-4">
        {[
          [String(dataset.letters.length), "封书信"],
          [String(recipientCount), "位通信对象"],
          [`${START_YEAR}—${END_YEAR}`, "书信时间范围"],
          [String(KNOWN_YEAR_COUNT), "封年代明确"],
        ].map(([value, label], index) => (
          <div className={`min-h-[76px] px-3 py-4 text-center ${index > 0 ? "border-l border-[var(--line)]" : ""}`} key={label}>
            <dd className={`${index === 2 ? "text-[17px]" : "text-[23px]"} whitespace-nowrap text-[var(--ink)]`}>{value}</dd>
            <dt className="mt-1 text-[9px] text-[var(--muted)]">{label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

function eventEntityItems(selectedEvent: EventType) {
  const counts = new Map<EntityType, { count: number; letterIds: string[] }>(ENTITY_ORDER.map((type) => [type, { count: 0, letterIds: [] }]));
  dataset.letters.forEach((letter) => {
    const events = (dataset.eventsByLetter[letter.id] ?? []).filter((event) => event.type === selectedEvent && event.start >= 0);
    const entities = (dataset.entitiesByLetter[letter.id] ?? []).filter((entity) => entity.start >= 0);
    entities.forEach((entity) => events.forEach((event) => {
      if (entity.start >= event.end || entity.end <= event.start) return;
      const item = counts.get(entity.type)!;
      item.count += 1;
      item.letterIds.push(letter.id);
    }));
  });
  return [...counts.entries()].map(([type, item]) => ({ type, label: entityTypeMeta[type].label, ...item })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
}

function ThemeAndEntities() {
  const [selectedEvent, setSelectedEvent] = useState<EventType>("BIB");
  const [selectedEntity, setSelectedEntity] = useState<EntityType | null>(null);
  const entityItems = useMemo(() => eventEntityItems(selectedEvent), [selectedEvent]);
  const entityTotal = entityItems.reduce((sum, item) => sum + item.count, 0);
  const selectedEntityItem = entityItems.find((item) => item.type === selectedEntity) ?? entityItems[0];

  const topicOption = useMemo(() => ({
    animationDuration: 380,
    textStyle: { fontFamily: '"Noto Serif SC", "Songti SC", STSong, SimSun, serif' },
    grid: { left: 76, right: 42, top: 18, bottom: 28 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#fffef9", borderColor: "#cfc8ba", textStyle: { color: "#27242a", fontSize: 12 }, formatter: (raw: unknown) => { const item = (raw as Array<{ name: string; value: number }>)[0]; return `${item?.name}<br/>${item?.value}个内容单元`; } },
    xAxis: { type: "value", show: false },
    yAxis: { type: "category", inverse: true, data: EVENT_ORDER.map((type) => eventTypeMeta[type].label), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#4f4a50", fontSize: 12 } },
    series: [{ type: "bar", barWidth: 18, data: EVENT_ORDER.map((type) => ({ value: DATA.events.get(type)?.count ?? 0, itemStyle: { color: EVENT_COLORS[type], opacity: type === selectedEvent ? .95 : .48, borderColor: type === selectedEvent ? "#27242a" : "transparent", borderWidth: type === selectedEvent ? 1 : 0 }, name: eventTypeMeta[type].label })), label: { show: true, position: "right", color: "#625d63", fontSize: 10 } }],
  }), [selectedEvent]);

  const entityOption = useMemo(() => ({
    animationDuration: 420,
    textStyle: { fontFamily: '"Noto Serif SC", "Songti SC", STSong, SimSun, serif' },
    tooltip: { trigger: "item", backgroundColor: "#fffef9", borderColor: "#cfc8ba", textStyle: { color: "#27242a", fontSize: 12 }, formatter: (raw: unknown) => { const item = raw as { name: string; value: number }; return `${item.name}<br/>${item.value}次 · ${percent(item.value, entityTotal)}`; } },
    series: [{ type: "pie", radius: [68, 122], center: ["50%", "50%"], selectedMode: "single", itemStyle: { borderColor: "#f8f6f0", borderWidth: 2 }, label: { color: "#59545a", fontSize: 11, formatter: (raw: { name: string; percent: number }) => raw.percent >= 5 ? raw.name : "" }, labelLine: { lineStyle: { color: "#b9b1a4" } }, data: entityItems.map((item) => ({ name: item.label, value: item.count, itemStyle: { color: ENTITY_COLORS[item.type] }, selected: item.type === selectedEntity })) }],
  }), [entityItems, entityTotal, selectedEntity]);

  const evidence = representativeLetter(selectedEntityItem?.letterIds ?? DATA.events.get(selectedEvent)?.letterIds ?? []);

  return (
    <div className="min-h-[500px] py-4">
      <div className="flex min-w-0 gap-5 overflow-x-auto border-y border-[var(--line)] py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="主题筛选">
        {EVENT_ORDER.map((type) => <button type="button" className={`shrink-0 border-0 border-b bg-transparent px-1 pb-1.5 text-[11px] ${selectedEvent === type ? "border-current text-[var(--ink)]" : "border-transparent text-[var(--muted)]"}`} style={selectedEvent === type ? { color: EVENT_COLORS[type] } : undefined} onClick={() => { setSelectedEvent(type); setSelectedEntity(null); }} aria-selected={selectedEvent === type} role="tab" key={type}>{eventTypeMeta[type].label}<span className="ml-2 text-[9px] tabular-nums">{DATA.events.get(type)?.count}</span></button>)}
      </div>
      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <article className="border-b border-[var(--line)] pt-5">
          <header className="flex items-end justify-between"><div><p className="text-[9px] tracking-[.12em] text-[var(--muted)]">全部内容单元</p><h3 className="mt-1 text-[18px]">主题分布</h3></div><span className="text-[10px] text-[var(--muted)]">点击条形切换主题</span></header>
          <div className="h-[330px] min-w-0"><ReactEChartsCore echarts={echarts} option={topicOption} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate opts={{ renderer: "canvas" }} onEvents={{ click: (params: { dataIndex?: number }) => { if (typeof params.dataIndex === "number") { setSelectedEvent(EVENT_ORDER[params.dataIndex]); setSelectedEntity(null); } } }} /></div>
        </article>
        <article className="border-b border-[var(--line)] pt-5">
          <header className="flex items-end justify-between"><div><p className="text-[9px] tracking-[.12em] text-[var(--muted)]">{eventTypeMeta[selectedEvent].label}</p><h3 className="mt-1 text-[18px]">实体构成</h3></div><span className="text-[10px] text-[var(--muted)]">{entityTotal}次关联</span></header>
          <div className="h-[330px] min-w-0"><ReactEChartsCore echarts={echarts} option={entityOption} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate opts={{ renderer: "canvas" }} onEvents={{ click: (params: { dataIndex?: number }) => { const item = typeof params.dataIndex === "number" ? entityItems[params.dataIndex] : null; if (item) setSelectedEntity(item.type); } }} /></div>
        </article>
      </div>
      <aside className="mt-4 grid gap-4 border-y border-[var(--line-dark)] px-5 py-3.5 md:grid-cols-[1fr_auto] md:items-center" aria-live="polite">
        <p className="text-[12px] leading-6 text-[var(--muted)]"><span className="text-[var(--ink)]">{eventTypeMeta[selectedEvent].label}</span>共有{DATA.events.get(selectedEvent)?.count}个内容单元；其中{selectedEntityItem?.label ?? "相关实体"}出现{selectedEntityItem?.count ?? 0}次，占当前实体关联的{percent(selectedEntityItem?.count ?? 0, entityTotal)}。</p>
        <Link className="border-b border-[var(--blue)] pb-1 text-[10px] text-[var(--blue)]" href={letterHref(evidence)}>代表书信 · 第{evidence.number}通 ↗</Link>
      </aside>
    </div>
  );
}

function ContentActions() {
  const orderedActions = [...DATA.actions.entries()].sort((a, b) => b[1].count - a[1].count);
  const [selectedAction, setSelectedAction] = useState<ActType>(orderedActions[0][0]);
  const active = DATA.actions.get(selectedAction)!;
  const evidenceId = unique(active.letterIds)[0];
  const evidence = letterMap.get(evidenceId) ?? dataset.letters[0];
  const act = (dataset.actsByLetter[evidence.id] ?? []).find((item) => item.type === selectedAction);
  const option = useMemo(() => ({
    animationDuration: 420,
    textStyle: { fontFamily: '"Noto Serif SC", "Songti SC", STSong, SimSun, serif' },
    grid: { left: 110, right: 55, top: 18, bottom: 28 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#fffef9", borderColor: "#cfc8ba", textStyle: { color: "#27242a", fontSize: 12 } },
    xAxis: { type: "value", show: false },
    yAxis: { type: "category", inverse: true, data: orderedActions.map(([type]) => ACTION_LABELS[type]), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#4f4a50", fontSize: 12 } },
    series: [{ type: "bar", barWidth: 22, data: orderedActions.map(([type, item]) => ({ value: item.count, itemStyle: { color: ACTION_COLORS[type], opacity: type === selectedAction ? .98 : .5, borderColor: type === selectedAction ? "#27242a" : "transparent", borderWidth: type === selectedAction ? 1 : 0 } })), label: { show: true, position: "right", color: "#625d63", fontSize: 11 } }],
  }), [orderedActions, selectedAction]);

  return (
    <div className="grid min-h-[500px] items-stretch gap-7 py-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,.68fr)]">
      <article className="border-y border-[var(--line)] py-5"><header className="flex items-end justify-between px-2"><div><p className="text-[9px] tracking-[.13em] text-[var(--muted)]">这些书信主要在做什么</p><h3 className="mt-1 text-[19px]">内容行动分布</h3></div><span className="text-[10px] text-[var(--muted)]">点击条形查看解释与原信</span></header><div className="h-[410px] min-w-0"><ReactEChartsCore echarts={echarts} option={option} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate opts={{ renderer: "canvas" }} onEvents={{ click: (params: { dataIndex?: number }) => { if (typeof params.dataIndex === "number") setSelectedAction(orderedActions[params.dataIndex][0]); } }} /></div></article>
      <aside className="flex min-h-[450px] flex-col border-y border-[var(--line-dark)] py-6" aria-live="polite">
        <p className="text-[10px] tracking-[.14em]" style={{ color: ACTION_COLORS[selectedAction] }}>当前行动</p>
        <h3 className="mt-3 text-[27px] font-normal">{ACTION_LABELS[selectedAction]}</h3>
        <p className="mt-4 text-[14px] leading-7 text-[var(--muted)]">{ACTION_DESCRIPTIONS[selectedAction]}</p>
        <dl className="mt-6 grid grid-cols-2 border-y border-[var(--line)] py-4"><div><dt className="text-[9px] text-[var(--muted)]">标注段落</dt><dd className="mt-1 text-[24px]">{active.count}</dd></div><div className="border-l border-[var(--line)] pl-4"><dt className="text-[9px] text-[var(--muted)]">涉及书信</dt><dd className="mt-1 text-[24px]">{unique(active.letterIds).length}</dd></div></dl>
        <div className="mt-auto border-t border-[var(--line)] pt-4"><p className="text-[9px] text-[var(--muted)]">代表书信 · 第{evidence.number}通 · 致{evidence.recipient}</p><blockquote className="mt-2 line-clamp-3 text-[13px] leading-6">“{cleanText(act?.originalText, 62)}”</blockquote><Link className="mt-3 inline-block border-b border-[var(--blue)] pb-1 text-[10px] text-[var(--blue)]" href={letterHref(evidence)}>查看书信详情 ↗</Link></div>
      </aside>
    </div>
  );
}

function YearDistribution() {
  const [rangeStart, setRangeStart] = useState(START_YEAR);
  const [rangeEnd, setRangeEnd] = useState(END_YEAR);
  const [selectedYear, setSelectedYear] = useState<number>(1919);
  const visibleYears = YEARS.filter((year) => year >= rangeStart && year <= rangeEnd);
  const selectedLetters = dataset.letters.filter((letter) => Number.parseInt(letter.year ?? "", 10) === selectedYear);
  const yearRecipients = [...new Map(selectedLetters.map((letter) => [letter.recipient, selectedLetters.filter((item) => item.recipient === letter.recipient).length])).entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const yearEvent = dominantEvent(selectedLetters.map((letter) => letter.id));
  const evidence = selectedLetters[0] ?? dataset.letters[0];
  const option = useMemo(() => {
    const counts = visibleYears.map((year) => DATA.yearCounts.get(year) ?? 0);
    return {
      animationDuration: 420,
      textStyle: { fontFamily: '"Noto Serif SC", "Songti SC", STSong, SimSun, serif' },
      grid: { left: 42, right: 22, top: 35, bottom: 48 },
      tooltip: { trigger: "axis", backgroundColor: "#fffef9", borderColor: "#cfc8ba", textStyle: { color: "#27242a", fontSize: 12 }, formatter: (raw: unknown) => { const item = (raw as Array<{ axisValue: string; data: number }>)[0]; return `<b>${item?.axisValue}年</b><br/>${item?.data}封书信`; } },
      xAxis: { type: "category", boundaryGap: false, data: visibleYears.map(String), axisLine: { lineStyle: { color: "#cfc8ba" } }, axisTick: { show: false }, axisLabel: { color: "#625d63", fontSize: 11, interval: visibleYears.length > 22 ? 3 : 1, margin: 14 } },
      yAxis: { type: "value", axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: "rgba(81,78,70,.09)", type: "dashed" } }, axisLabel: { color: "#7b757b", fontSize: 10 } },
      series: [{ type: "line", data: counts, smooth: .18, showSymbol: true, symbolSize: (value: number, params: { dataIndex: number }) => visibleYears[params.dataIndex] === selectedYear ? 9 : 5, lineStyle: { color: "#9a7c45", width: 2 }, itemStyle: { color: (params: { dataIndex: number }) => visibleYears[params.dataIndex] === selectedYear ? "#526b80" : "#9a7c45", borderColor: "#f8f6f0", borderWidth: 2 }, areaStyle: { color: "rgba(154,124,69,.08)" } }],
    };
  }, [selectedYear, visibleYears]);

  return (
    <div className="min-h-[500px] py-4">
      <article className="border-y border-[var(--line)] py-4"><header className="flex flex-wrap items-end justify-between gap-3 px-2"><div><p className="text-[9px] tracking-[.13em] text-[var(--muted)]">横轴为公历年代</p><h3 className="mt-1 text-[19px]">现存书信年代分布</h3></div><span className="text-[10px] text-[var(--muted)]">悬停查看数量 · 点击锁定年份</span></header><div className="h-[340px] min-w-0"><ReactEChartsCore echarts={echarts} option={option} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate opts={{ renderer: "canvas" }} onEvents={{ click: (params: { dataIndex?: number }) => { if (typeof params.dataIndex === "number") setSelectedYear(visibleYears[params.dataIndex]); } }} /></div>
        <div className="grid gap-3 border-t border-[var(--line)] px-2 pt-3 sm:grid-cols-2">
          <label className="grid grid-cols-[70px_1fr_42px] items-center gap-2 text-[10px] text-[var(--muted)]"><span>起始年份</span><input type="range" min={START_YEAR} max={rangeEnd - 1} value={rangeStart} onChange={(event) => setRangeStart(Number(event.target.value))} className="accent-[var(--gold)]" /><span className="text-right text-[var(--ink)]">{rangeStart}</span></label>
          <label className="grid grid-cols-[70px_1fr_42px] items-center gap-2 text-[10px] text-[var(--muted)]"><span>结束年份</span><input type="range" min={rangeStart + 1} max={END_YEAR} value={rangeEnd} onChange={(event) => setRangeEnd(Number(event.target.value))} className="accent-[var(--gold)]" /><span className="text-right text-[var(--ink)]">{rangeEnd}</span></label>
        </div>
      </article>
      <aside className="mt-4 grid gap-4 border-y border-[var(--line-dark)] px-5 py-3.5 md:grid-cols-[auto_1fr_auto] md:items-center" aria-live="polite"><div><span className="text-[25px]">{selectedYear}</span><small className="ml-1 text-[10px] text-[var(--muted)]">年</small><span className="ml-5 text-[13px]">{selectedLetters.length}封</span></div><p className="text-[11px] leading-6 text-[var(--muted)]">主要通信对象：{yearRecipients.map(([name, count]) => `${name}${count}封`).join("、") || "暂无"}；主要主题：{eventTypeMeta[yearEvent].label}。</p><Link className="border-b border-[var(--blue)] pb-1 text-[10px] text-[var(--blue)]" href={letterHref(evidence)}>代表书信 ↗</Link></aside>
    </div>
  );
}

function RecipientAnalysis({ onOpenAll }: { onOpenAll: () => void }) {
  const top = DATA.recipientRows.slice(0, 10);
  const [selectedName, setSelectedName] = useState(top[0].name);
  const selected = DATA.recipientRows.find((row) => row.name === selectedName) ?? top[0];
  const theme = dominantEvent(selected.letterIds);
  const evidence = representativeLetter(selected.letterIds);
  const option = useMemo(() => ({
    animationDuration: 420,
    textStyle: { fontFamily: '"Noto Serif SC", "Songti SC", STSong, SimSun, serif' },
    grid: { left: 76, right: 44, top: 18, bottom: 26 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#fffef9", borderColor: "#cfc8ba", textStyle: { color: "#27242a", fontSize: 12 } },
    xAxis: { type: "value", show: false },
    yAxis: { type: "category", inverse: true, data: top.map((row) => row.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#4f4a50", fontSize: 12 } },
    series: [{ type: "bar", barWidth: 17, data: top.map((row) => ({ value: row.count, itemStyle: { color: row.name === selectedName ? "#526b80" : "#9a7c45", opacity: row.name === selectedName ? .95 : .48 } })), label: { show: true, position: "right", color: "#625d63", fontSize: 10 } }],
  }), [selectedName, top]);

  return (
    <div className="min-h-[500px] py-4">
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(350px,.75fr)]">
        <article className="border-y border-[var(--line)] py-5"><header className="flex items-end justify-between px-2"><div><p className="text-[9px] tracking-[.13em] text-[var(--muted)]">按现存书信数量排序</p><h3 className="mt-1 text-[19px]">主要通信对象</h3></div><span className="text-[10px] text-[var(--muted)]">点击人物查看摘要</span></header><div className="h-[405px] min-w-0"><ReactEChartsCore echarts={echarts} option={option} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate opts={{ renderer: "canvas" }} onEvents={{ click: (params: { dataIndex?: number }) => { if (typeof params.dataIndex === "number") setSelectedName(top[params.dataIndex].name); } }} /></div></article>
        <aside className="border-y border-[var(--line-dark)] py-5"><header className="grid grid-cols-[38px_1fr_50px_58px] border-b border-[var(--line)] pb-3 text-[9px] text-[var(--muted)]"><span>排名</span><span>人物</span><span className="text-right">封数</span><span className="text-right">操作</span></header>{top.slice(0, 8).map((row, index) => <button type="button" className={`grid min-h-[44px] w-full grid-cols-[38px_1fr_50px_58px] items-center border-0 border-b border-[var(--line)] bg-transparent text-left ${row.name === selectedName ? "bg-[rgba(82,107,128,.06)] text-[var(--blue)]" : ""}`} onClick={() => setSelectedName(row.name)} key={row.name}><span className="text-[9px] text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span><span className="text-[12px]">{row.name}<small className="mt-0.5 block text-[9px] text-[var(--muted)]">{eventTypeMeta[dominantEvent(row.letterIds)].label}</small></span><span className="text-right text-[11px] tabular-nums">{row.count}</span><span className="text-right text-[9px]">查看</span></button>)}<button type="button" className="mt-4 border border-[var(--line-dark)] px-3 py-2 text-[10px]" onClick={onOpenAll}>查看全部通信对象</button></aside>
      </div>
      <aside className="mt-4 grid gap-4 border-y border-[var(--line-dark)] px-5 py-3.5 md:grid-cols-[auto_1fr_auto] md:items-center" aria-live="polite"><div><span className="text-[17px]">{selected.name}</span><span className="ml-4 text-[12px] text-[var(--muted)]">{selected.count}封</span></div><p className="text-[11px] leading-6 text-[var(--muted)]">主要主题为{eventTypeMeta[theme].label}，占该人物往来中已标注主题的主要部分。</p><Link className="border-b border-[var(--blue)] pb-1 text-[10px] text-[var(--blue)]" href={letterHref(evidence)}>代表书信 ↗</Link></aside>
    </div>
  );
}

export function CollectionResearch({
  activeView,
  onViewChange,
  onOpenRecipients,
}: {
  activeView: number;
  onViewChange: (index: number) => void;
  onOpenRecipients: () => void;
}) {
  return (
    <div className="min-w-0">
      <CollectionSummary />
      <ResearchCarousel labels={VIEW_LABELS} activeIndex={activeView} onChange={onViewChange} ariaLabel="书信收录问题分析">
        {activeView === 0 && <ThemeAndEntities />}
        {activeView === 1 && <ContentActions />}
        {activeView === 2 && <YearDistribution />}
        {activeView === 3 && <RecipientAnalysis onOpenAll={onOpenRecipients} />}
      </ResearchCarousel>
    </div>
  );
}

export function RecipientDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-[var(--line-dark)] bg-[var(--paper)] px-6 py-5 sm:px-8">
        <div><p className="text-[9px] tracking-[.16em] text-[var(--purple)]">通信对象索引</p><h2 className="mt-2 text-[23px] font-normal">全部通信对象</h2><p className="mt-1 text-[10px] text-[var(--muted)]">共{DATA.recipientRows.length}位</p></div>
        <button type="button" className="grid size-9 place-items-center border border-[var(--line)] text-[18px]" onClick={onClose} aria-label="关闭通信对象面板">×</button>
      </header>
      <div className="px-6 pb-10 sm:px-8">
        <div className="grid grid-cols-[46px_1fr_60px_100px] border-b border-[var(--line)] py-3 text-[9px] text-[var(--muted)]"><span>排名</span><span>人物</span><span className="text-right">书信</span><span className="text-right">主要主题</span></div>
        {DATA.recipientRows.map((row, index) => {
          const theme = dominantEvent(row.letterIds);
          const evidence = representativeLetter(row.letterIds);
          return <Link className="grid min-h-[54px] grid-cols-[46px_1fr_60px_100px] items-center border-b border-[var(--line)] text-[11px] transition hover:bg-[rgba(82,107,128,.045)]" href={letterHref(evidence)} key={row.name}><span className="text-[9px] text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span><span className="text-[13px]">{row.name}</span><span className="text-right tabular-nums">{row.count}</span><span className="text-right text-[10px] text-[var(--muted)]">{eventTypeMeta[theme].label} ↗</span></Link>;
        })}
      </div>
    </div>
  );
}
