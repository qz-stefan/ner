"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
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
const ACTION_ORDER: ActType[] = ["AST", "DIR", "EXP", "COM"];
const VIEW_LABELS = ["材料概况", "事件与对象结构", "内容行动"] as const;

const ACTION_LABELS: Record<ActType, string> = {
  AST: "陈述",
  DIR: "指示",
  EXP: "表达",
  COM: "承诺",
};

const ACTION_DESCRIPTIONS: Record<ActType, string> = {
  AST: "陈述事实、论证观点或评价事物，是书信中最常见的行动。",
  DIR: "提出建议、询问信息或发出请求，推动对方采取行动。",
  EXP: "表达问候、祝颂、感谢、庆贺或致歉等情感，维系通信关系。",
  COM: "承诺采取行动或提供帮助与资源。",
};

const OBJECT_HEAT_PALETTE = ["#f2eee7", "#e9ddcf", "#d9c4aa", "#bda17e", "#97734f", "#6c4d35"];

const EVENT_COLORS: Record<EventType, string> = {
  SOC: "#9a6d62", BIB: "#746d91", ACA: "#557985", POL: "#9a845b", FAM: "#668071",
};

const ENTITY_COLORS: Record<EntityType, string> = {
  PER: "#955c56", LOC: "#587086", BOK: "#987b43", VER: "#7a6688", TIM: "#8c6f55",
  OFF: "#686d8f", ORG: "#53777a", KIN: "#986b76", AST: "#4f776b",
};

const ACTION_COLORS: Record<ActType, string> = {
  AST: "#667779", DIR: "#83b8a1", EXP: "#4f8d73", COM: "#285f4c",
};

const letterMap = new Map(dataset.letters.map((letter) => [letter.id, letter]));

type EventActionSummary = { count: number; letterIds: string[]; subtypeCounts: Map<string, number> };

function buildEventActionData() {
  const data = Object.fromEntries(EVENT_ORDER.map((eventType) => [
    eventType,
    Object.fromEntries(ACTION_ORDER.map((actionType) => [actionType, { count: 0, letterIds: [], subtypeCounts: new Map<string, number>() }])) as unknown as Record<ActType, EventActionSummary>,
  ])) as Record<EventType, Record<ActType, EventActionSummary>>;

  dataset.letters.forEach((letter) => {
    const eventTypes = new Map((dataset.eventsByLetter[letter.id] ?? []).map((event) => [event.id, event.type]));
    (dataset.actsByLetter[letter.id] ?? []).forEach((act) => {
      act.eventLinks.forEach((link) => {
        const eventType = eventTypes.get(link.eventId);
        if (!eventType || !EVENT_ORDER.includes(eventType)) return;
        const summary = data[eventType][act.type];
        summary.count += 1;
        summary.letterIds.push(letter.id);
        const subtype = act.subtype?.trim() || "未分类";
        summary.subtypeCounts.set(subtype, (summary.subtypeCounts.get(subtype) ?? 0) + 1);
      });
    });
  });
  return data;
}

const EVENT_ACTION_DATA = buildEventActionData();

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

function ResponsiveEChart({
  option,
  onEvents,
  className,
}: {
  option: object;
  onEvents?: ComponentProps<typeof ReactEChartsCore>["onEvents"];
  className: string;
}) {
  const chartRef = useRef<ReactEChartsCore | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    const container = containerRef.current;
    if (!instance || !container) return;
    const resize = () => instance.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    window.addEventListener("resize", resize);
    window.requestAnimationFrame(resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [option]);

  return (
    <div ref={containerRef} className={className}>
      <ReactEChartsCore ref={chartRef} echarts={echarts} option={option} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate opts={{ renderer: "canvas" }} onEvents={onEvents} />
    </div>
  );
}

function buildCollectionData() {
  const yearCounts = new Map<number, number>(YEARS.map((year) => [year, 0]));
  const recipients = new Map<string, string[]>();
  const recipientYearCounts = new Map<string, Map<number, number>>();
  const events = new Map<EventType, { count: number; letterIds: string[] }>(EVENT_ORDER.map((type) => [type, { count: 0, letterIds: [] }]));
  const actions = new Map<ActType, { count: number; letterIds: string[] }>(ACTION_ORDER.map((type) => [type, { count: 0, letterIds: [] }]));

  dataset.letters.forEach((letter) => {
    const year = Number.parseInt(letter.year ?? "", 10);
    if (year >= START_YEAR && year <= END_YEAR) {
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
      if (!recipientYearCounts.has(letter.recipient)) recipientYearCounts.set(letter.recipient, new Map());
      const recipientYears = recipientYearCounts.get(letter.recipient)!;
      recipientYears.set(year, (recipientYears.get(year) ?? 0) + 1);
    }
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

  return { yearCounts, recipients, recipientYearCounts, recipientRows, events, actions };
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
    series: [{
      type: "pie",
      center: ["52%", "55%"],
      radius: ["29%", "50%"],
      selectedMode: "single",
      avoidLabelOverlap: true,
      itemStyle: { borderColor: "#f8f6f0", borderWidth: 2 },
      label: {
        show: true,
        position: "outside",
        formatter: "{b}",
        color: "#59545a",
        fontSize: 11,
        lineHeight: 16,
        width: 96,
        overflow: "break",
        alignTo: "edge",
        edgeDistance: 18,
        bleedMargin: 8,
        minMargin: 6,
      },
      labelLine: { show: true, length: 16, length2: 26, minTurnAngle: 35, maxSurfaceAngle: 80, lineStyle: { color: "#a9a195", width: 1 } },
      labelLayout: { hideOverlap: false, moveOverlap: "shiftY" },
      data: entityItems.map((item) => ({ name: item.label, value: item.count, itemStyle: { color: ENTITY_COLORS[item.type] }, selected: item.type === selectedEntity })),
    }],
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
          <ResponsiveEChart className="h-[390px] min-w-0" option={topicOption} onEvents={{ click: (params: { dataIndex?: number }) => { if (typeof params.dataIndex === "number") { setSelectedEvent(EVENT_ORDER[params.dataIndex]); setSelectedEntity(null); } } }} />
        </article>
        <article className="overflow-visible border-b border-[var(--line)] pt-5">
          <header className="flex items-end justify-between"><div><p className="text-[9px] tracking-[.12em] text-[var(--muted)]">{eventTypeMeta[selectedEvent].label}</p><h3 className="mt-1 text-[18px]">实体构成</h3></div><span className="text-[10px] text-[var(--muted)]">{entityTotal}次关联</span></header>
          <ResponsiveEChart className="h-[390px] min-w-0 overflow-visible" option={entityOption} onEvents={{ click: (params: { dataIndex?: number }) => { const item = typeof params.dataIndex === "number" ? entityItems[params.dataIndex] : null; if (item) setSelectedEntity(item.type); } }} />
        </article>
      </div>
      <aside className="mt-4 grid gap-4 border-y border-[var(--line-dark)] px-5 py-3.5 md:grid-cols-[1fr_auto] md:items-center" aria-live="polite">
        <p className="text-[12px] leading-6 text-[var(--muted)]"><span className="text-[var(--ink)]">{eventTypeMeta[selectedEvent].label}</span>共有{DATA.events.get(selectedEvent)?.count}个内容单元；其中{selectedEntityItem?.label ?? "相关实体"}出现{selectedEntityItem?.count ?? 0}次，占当前实体关联的{percent(selectedEntityItem?.count ?? 0, entityTotal)}。</p>
        <Link className="border-b border-[var(--blue)] pb-1 text-[10px] text-[var(--blue)]" href={letterHref(evidence)}>代表书信 · 第{evidence.number}通 ↗</Link>
      </aside>
    </div>
  );
}

type EventEntityCell = { count: number; letterIds: string[] };

function buildEventEntityMatrix() {
  const matrix = Object.fromEntries(EVENT_ORDER.map((eventType) => [
    eventType,
    Object.fromEntries(ENTITY_ORDER.map((entityType) => [entityType, { count: 0, letterIds: [] as string[] }])) as unknown as Record<EntityType, EventEntityCell>,
  ])) as Record<EventType, Record<EntityType, EventEntityCell>>;
  dataset.letters.forEach((letter) => {
    const events = (dataset.eventsByLetter[letter.id] ?? []).filter((event) => event.start >= 0 && EVENT_ORDER.includes(event.type));
    const entities = (dataset.entitiesByLetter[letter.id] ?? []).filter((entity) => entity.start >= 0);
    entities.forEach((entity) => events.forEach((event) => {
      if (entity.start >= event.end || entity.end <= event.start) return;
      matrix[event.type][entity.type].count += 1;
      matrix[event.type][entity.type].letterIds.push(letter.id);
    }));
  });
  return matrix;
}

const EVENT_ENTITY_MATRIX = buildEventEntityMatrix();

function EventObjectStructure() {
  const [mode, setMode] = useState<"share" | "count">("share");
  const [showAllNumbers, setShowAllNumbers] = useState(false);
  const [selected, setSelected] = useState<{ event: EventType; entity: EntityType }>({ event: "BIB", entity: "BOK" });
  const maxCount = Math.max(...EVENT_ORDER.flatMap((eventType) => ENTITY_ORDER.map((entityType) => EVENT_ENTITY_MATRIX[eventType][entityType].count)));
  const selectedRow = EVENT_ENTITY_MATRIX[selected.event];
  const selectedCell = selectedRow[selected.entity];
  const selectedRowTotal = ENTITY_ORDER.reduce((sum, entityType) => sum + selectedRow[entityType].count, 0);
  const rowRank = [...ENTITY_ORDER].sort((a, b) => selectedRow[b].count - selectedRow[a].count).indexOf(selected.entity) + 1;
  const strongestEvent = EVENT_ORDER.map((eventType) => {
    const row = EVENT_ENTITY_MATRIX[eventType];
    const rowTotal = ENTITY_ORDER.reduce((sum, entityType) => sum + row[entityType].count, 0);
    return { eventType, share: rowTotal ? row[selected.entity].count / rowTotal : 0 };
  }).sort((a, b) => b.share - a.share)[0]?.eventType ?? selected.event;
  const evidence = representativeLetter(selectedCell.letterIds.length ? selectedCell.letterIds : DATA.events.get(selected.event)?.letterIds ?? []);
  const finding = `${entityTypeMeta[selected.entity].label}在${eventTypeMeta[selected.event].label}的对象关联中排名第${rowRank}，占${percent(selectedCell.count, selectedRowTotal)}。${strongestEvent === selected.event ? `这也是${entityTypeMeta[selected.entity].label}在五类事件中占比最高的语境。` : `从相对比例看，${entityTypeMeta[selected.entity].label}在${eventTypeMeta[strongestEvent].label}中更为突出。`}`;

  const heatLevel = (value: number, share: number) => {
    const normalized = mode === "share" ? share : maxCount ? value / maxCount : 0;
    const thresholds = mode === "share" ? [.005, .05, .10, .20, .30] : [.005, .05, .15, .30, .60];
    return thresholds.filter((threshold) => normalized >= threshold).length;
  };

  return (
    <div className="min-h-[500px] py-4">
      <header className="grid gap-5 border-b border-[var(--line)] pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.48fr)] lg:items-end">
        <div><p className="text-[9px] tracking-[.14em] text-[#6c4d35]">02 · EVENT × ENTITY</p><h3 className="mt-2 text-[25px] font-normal">事件与对象结构</h3><p className="mt-2 max-w-[760px] text-[11px] leading-6 text-[var(--muted)]">在同一视野中比较五类事件围绕哪些对象展开。圆角色块的明暗表示关联强弱，点击单格显示数值与结构解释。</p></div>
        <aside className="border-l-2 border-[#6c4d35] bg-[#f2ece3] px-4 py-3" aria-live="polite"><span className="text-[8px] tracking-[.13em] text-[#60432e]">当前发现</span><p className="mt-2 text-[10px] leading-5 text-[#66574d]">{finding}</p></aside>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-2">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2"><span className="mr-1 text-[8px] text-[var(--muted)]">显示口径</span>{(["share", "count"] as const).map((value) => <button type="button" className={`border-0 border-b bg-transparent px-1 py-1 text-[9px] transition ${mode === value ? "border-[#6c4d35] text-[#6c4d35]" : "border-transparent text-[var(--muted)] hover:text-[#6c4d35]"}`} onClick={() => setMode(value)} aria-pressed={mode === value} key={value}>{value === "share" ? "构成比例" : "关联次数"}</button>)}</div>
          <div className="flex items-center gap-2 border-l border-[var(--line)] pl-4"><span className="mr-1 text-[8px] text-[var(--muted)]">格内数字</span>{[true, false].map((value) => <button type="button" className={`border-0 border-b bg-transparent px-1 py-1 text-[9px] transition ${showAllNumbers === value ? "border-[#6c4d35] text-[#6c4d35]" : "border-transparent text-[var(--muted)] hover:text-[#6c4d35]"}`} onClick={() => setShowAllNumbers(value)} aria-pressed={showAllNumbers === value} key={String(value)}>{value ? "显示" : "隐藏"}</button>)}</div>
        </div>
        <div className="flex items-center gap-1 text-[8px] text-[var(--muted)]"><span>较低</span>{OBJECT_HEAT_PALETTE.map((color) => <i className="block h-3 w-[18px] rounded" style={{ background: color }} key={color} />)}<span>较高</span><small className="ml-2">悬停看数值 · 点击查看解释</small></div>
      </div>

      <div className="mt-4 grid items-stretch gap-5 xl:grid-cols-[minmax(760px,1.75fr)_minmax(280px,.58fr)]">
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-[#dcd5ca] bg-[rgba(255,253,248,.72)] p-4 shadow-[0_9px_28px_rgba(55,47,42,.035)]">
          <div className="grid min-w-[850px] gap-2" style={{ gridTemplateColumns: "142px repeat(9,minmax(56px,1fr)) 58px" }}>
            <div />{ENTITY_ORDER.map((entityType) => <div className="grid min-h-10 place-items-center text-[9px] text-[var(--muted)]" key={entityType}>{entityTypeMeta[entityType].label}</div>)}<div className="grid min-h-10 place-items-center text-[9px] text-[var(--muted)]">事件数</div>
            {EVENT_ORDER.flatMap((eventType) => {
              const row = EVENT_ENTITY_MATRIX[eventType];
              const rowTotal = ENTITY_ORDER.reduce((sum, entityType) => sum + row[entityType].count, 0);
              return [
                <div className="flex min-h-[58px] flex-col justify-center px-1" key={`${eventType}-label`}><strong className="text-[12px] font-normal">{eventTypeMeta[eventType].label}</strong><small className="mt-1 text-[8px] text-[var(--muted)]">{unique(DATA.events.get(eventType)?.letterIds ?? []).length}封书信</small></div>,
                ...ENTITY_ORDER.map((entityType) => {
                  const cell = row[entityType];
                  const share = rowTotal ? cell.count / rowTotal : 0;
                  const level = heatLevel(cell.count, share);
                  const active = selected.event === eventType && selected.entity === entityType;
                  const visible = showAllNumbers || active;
                  const value = mode === "share" ? (share > 0 && share < .005 ? "<1%" : percent(cell.count, rowTotal, 0)) : cell.count.toLocaleString("zh-CN");
                  return <button type="button" className={`relative grid min-h-[58px] place-items-center rounded-lg border-0 transition hover:-translate-y-px hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60432e] ${active ? "outline outline-2 outline-offset-2 outline-[#60432e] shadow-md" : ""}`} style={{ background: OBJECT_HEAT_PALETTE[level], color: level >= 4 ? "#fffdf8" : level >= 2 ? "#443328" : "#77736e" }} onClick={() => setSelected({ event: eventType, entity: entityType })} aria-label={`${eventTypeMeta[eventType].label}与${entityTypeMeta[entityType].label}：${cell.count}次关联，占${percent(cell.count, rowTotal)}`} title={`${eventTypeMeta[eventType].label} × ${entityTypeMeta[entityType].label}：${cell.count}次，${percent(cell.count, rowTotal)}`} key={`${eventType}-${entityType}`}><strong className={`text-[12px] font-semibold tabular-nums transition ${visible ? "opacity-100" : "opacity-0"}`}>{value}</strong>{active && <i className="absolute right-2 top-2 size-1.5 rotate-45 bg-[#60432e]" aria-hidden="true" />}</button>;
                }),
                <div className="flex min-h-[58px] items-center justify-center text-[10px] tabular-nums text-[var(--muted)]" key={`${eventType}-total`}>{DATA.events.get(eventType)?.count ?? 0}<small className="ml-0.5 text-[8px]">个</small></div>,
              ];
            })}
          </div>
        </div>

        <aside className="flex min-h-[390px] flex-col rounded-2xl bg-[#f2ece3] px-6 py-6" aria-live="polite"><p className="text-[8px] tracking-[.14em] text-[#60432e]">SELECTED RELATION</p><h3 className="mt-3 text-[23px] font-normal">{eventTypeMeta[selected.event].label} × {entityTypeMeta[selected.entity].label}</h3><p className="mt-1 text-[11px] text-[var(--muted)]"><strong className="mr-1 text-[28px] font-normal text-[var(--ink)]">{selectedCell.count.toLocaleString("zh-CN")}</strong>次关联 · {percent(selectedCell.count, selectedRowTotal)}</p><p className="mt-5 text-[11px] leading-6 text-[#66574d]">{finding}</p><dl className="mt-auto grid grid-cols-2 border-y border-[rgba(96,67,46,.2)]"><div className="px-2 py-4"><dt className="text-[8px] text-[var(--muted)]">当前事件内排名</dt><dd className="mt-1 text-[15px]">第 {rowRank} 位</dd></div><div className="border-l border-[rgba(96,67,46,.2)] px-3 py-4"><dt className="text-[8px] text-[var(--muted)]">涉及书信</dt><dd className="mt-1 text-[15px]">{unique(selectedCell.letterIds).length} 封</dd></div></dl><Link className="mt-4 w-fit border-b border-[#6c4d35] pb-1 text-[9px] text-[#6c4d35]" href={letterHref(evidence)}>查看代表书信 · 第{evidence.number}通 ↗</Link></aside>
      </div>

      <details className="group mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[rgba(255,253,248,.38)]"><summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden"><span className="text-[11px]">查看完整数值表</span><small className="text-[8px] text-[var(--muted)]">用于核对准确数据</small><span className="ml-auto text-[9px] text-[#6c4d35] group-open:hidden">展开 ↓</span><span className="ml-auto hidden text-[9px] text-[#6c4d35] group-open:inline">收起 ↑</span></summary><div className="overflow-x-auto px-4 pb-4"><table className="w-full min-w-[850px] border-collapse bg-[var(--surface)] text-[9px]"><thead><tr><th className="border border-[var(--line)] px-3 py-2 text-left font-normal text-[var(--muted)]">事件类型</th>{ENTITY_ORDER.map((entityType) => <th className="border border-[var(--line)] px-3 py-2 text-right font-normal text-[var(--muted)]" key={entityType}>{entityTypeMeta[entityType].label}</th>)}<th className="border border-[var(--line)] px-3 py-2 text-right font-normal text-[var(--muted)]">事件数</th></tr></thead><tbody>{EVENT_ORDER.map((eventType) => { const row = EVENT_ENTITY_MATRIX[eventType]; const rowTotal = ENTITY_ORDER.reduce((sum, entityType) => sum + row[entityType].count, 0); return <tr key={eventType}><td className="border border-[var(--line)] px-3 py-2 text-left">{eventTypeMeta[eventType].label}</td>{ENTITY_ORDER.map((entityType) => <td className="border border-[var(--line)] px-3 py-2 text-right tabular-nums" key={entityType}>{row[entityType].count} · {percent(row[entityType].count, rowTotal)}</td>)}<td className="border border-[var(--line)] px-3 py-2 text-right tabular-nums">{DATA.events.get(eventType)?.count ?? 0}</td></tr>; })}</tbody></table></div></details>
    </div>
  );
}

function ContentActions() {
  const [selectedEvent, setSelectedEvent] = useState<EventType>("BIB");
  const [selectedAction, setSelectedAction] = useState<ActType>("DIR");
  const selectedSummary = EVENT_ACTION_DATA[selectedEvent][selectedAction];
  const eventRow = EVENT_ACTION_DATA[selectedEvent];
  const eventTotal = ACTION_ORDER.reduce((sum, type) => sum + eventRow[type].count, 0);
  const nonStatementTotal = ACTION_ORDER.filter((type) => type !== "AST").reduce((sum, type) => sum + eventRow[type].count, 0);
  const subtypeItems = [...selectedSummary.subtypeCounts.entries()].sort((a, b) => b[1] - a[1]);
  const selectedEventRank = [...EVENT_ORDER].sort((a, b) => {
    const aTotal = ACTION_ORDER.reduce((sum, type) => sum + EVENT_ACTION_DATA[a][type].count, 0);
    const bTotal = ACTION_ORDER.reduce((sum, type) => sum + EVENT_ACTION_DATA[b][type].count, 0);
    const aShare = aTotal ? EVENT_ACTION_DATA[a][selectedAction].count / aTotal : 0;
    const bShare = bTotal ? EVENT_ACTION_DATA[b][selectedAction].count / bTotal : 0;
    return bShare - aShare;
  }).indexOf(selectedEvent) + 1;
  const evidence = letterMap.get(unique(selectedSummary.letterIds)[0]) ?? dataset.letters[0];
  const relationCopy = `${eventTypeMeta[selectedEvent].label}中的${ACTION_LABELS[selectedAction]}占${percent(selectedSummary.count, eventTotal)}；在五类事件中，其相对比例排名第${selectedEventRank}。${ACTION_DESCRIPTIONS[selectedAction]}`;

  const selectAction = (event: EventType, action: ActType) => {
    setSelectedEvent(event);
    setSelectedAction(action);
  };

  return (
    <div className="py-4">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div><p className="text-[9px] tracking-[.13em] text-[var(--muted)]">不同事件如何表达</p><h3 className="mt-1 text-[22px] font-normal">五类事件的行动构成</h3></div>
        <div className="flex items-center gap-4 text-[10px] text-[var(--muted)]"><span>点击色段查看内部构成</span>{ACTION_ORDER.map((type) => <span className="flex items-center gap-1.5" key={type}><i className="h-2 w-5 rounded-full" style={{ background: ACTION_COLORS[type] }} />{ACTION_LABELS[type]}</span>)}</div>
      </header>

      <div className="border-b border-[var(--line-dark)]">
        {EVENT_ORDER.map((eventType) => {
          const row = EVENT_ACTION_DATA[eventType];
          const total = ACTION_ORDER.reduce((sum, type) => sum + row[type].count, 0);
          const residual = ACTION_ORDER.filter((type) => type !== "AST").reduce((sum, type) => sum + row[type].count, 0);
          const statement = row.AST.count;
          return <div className="grid min-h-[68px] items-center gap-5 border-b border-[var(--line)] py-2 last:border-b-0 lg:grid-cols-[145px_155px_minmax(360px,1fr)_140px]" key={eventType}>
            <div><strong className="block text-[17px] font-normal">{eventTypeMeta[eventType].label}</strong><small className="mt-1 block text-[10px] text-[var(--muted)]">{unique(DATA.events.get(eventType)?.letterIds ?? []).length}封书信</small></div>
            <button type="button" className="inline-flex items-baseline gap-2 text-left transition hover:text-[#657984]" onClick={() => selectAction(eventType, "AST")} aria-label={`${eventTypeMeta[eventType].label}中的陈述：${statement}次，占${percent(statement, total)}`}><span className="text-[14px] text-[var(--muted)]">陈述</span><strong className="text-[19px] font-normal">{percent(statement, total, 0)}</strong></button>
            <div className="flex h-[30px] min-w-0 overflow-hidden rounded-[7px] bg-[#e6e1d9] shadow-[0_4px_12px_rgba(76,66,55,.03)]" aria-label={`${eventTypeMeta[eventType].label}非陈述内部构成`}>
              {ACTION_ORDER.filter((type) => type !== "AST").map((type) => {
                const share = residual ? row[type].count / residual * 100 : 0;
                return <button type="button" className="min-w-[3px] border-0 border-r-[3px] border-solid border-[#f8f6f0] px-2 text-center font-medium text-[#fffdf8] transition last:border-r-0 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f8f6f0]" style={{ flex: `${Math.max(row[type].count, residual * .012)} 1 0`, background: ACTION_COLORS[type], filter: selectedEvent === eventType && selectedAction === type ? "brightness(.91) saturate(1.08)" : undefined }} onClick={() => selectAction(eventType, type)} key={type} aria-label={`${eventTypeMeta[eventType].label}中的${ACTION_LABELS[type]}：${row[type].count}次，占非陈述${percent(row[type].count, residual)}`}>{share >= 11 ? <span className="text-[9px] text-[#fffdf8]">{ACTION_LABELS[type]} {percent(share, 100, 0)}</span> : null}</button>;
              })}
            </div>
            <div className="inline-flex items-baseline gap-2"><span className="text-[14px] text-[var(--muted)]">非陈述</span><strong className="text-[19px] font-normal">{percent(residual, total, 0)}</strong></div>
          </div>;
        })}
      </div>
      <div className="mt-3 grid items-stretch gap-3 lg:grid-cols-[minmax(380px,.82fr)_minmax(520px,1.18fr)]">
        <section className="min-h-[128px] border border-[var(--line)] bg-[rgba(255,253,248,.55)] px-4 py-3.5" aria-live="polite">
          <header className="flex items-start justify-between gap-3" style={{ color: ACTION_COLORS[selectedAction] }}><div><span className="text-[10px] tracking-[.1em]">内部构成</span><h3 className="mt-1 text-[24px] font-normal">{ACTION_LABELS[selectedAction]}</h3></div><p className="mt-1 text-[10px] text-[var(--muted)]"><strong className="text-[17px] font-normal text-[var(--ink)]">{selectedSummary.count.toLocaleString("zh-CN")}</strong> 段</p></header>
          <div className="mt-2 grid grid-cols-2">{subtypeItems.map(([label, count]) => <div className="grid grid-cols-[minmax(40px,1fr)_auto] items-baseline gap-2 border-l border-[var(--line)] px-2 py-1" key={label}><span className="text-[14px]">{label}</span><small className="text-right text-[13px] text-[var(--muted)]">{percent(count, selectedSummary.count)}</small></div>)}</div>
        </section>
        <aside className="grid min-h-[128px] items-center gap-3 border border-[var(--line)] bg-[rgba(255,253,248,.45)] px-4 py-3.5 lg:grid-cols-[minmax(185px,.75fr)_150px_minmax(260px,1.2fr)]" aria-live="polite">
          <div><p className="text-[10px] tracking-[.12em]" style={{ color: ACTION_COLORS[selectedAction] }}>当前关系</p><h3 className="mt-1 text-[23px] font-normal">{eventTypeMeta[selectedEvent].label} × {ACTION_LABELS[selectedAction]}</h3></div>
          <p className="text-[12px] text-[var(--muted)]"><strong className="mr-1 text-[30px] font-normal text-[var(--ink)]">{selectedSummary.count.toLocaleString("zh-CN")}</strong>次关联 · <span className="text-[20px] text-[var(--ink)]">{percent(selectedSummary.count, eventTotal)}</span></p>
          <p className="text-[12px] leading-6 text-[var(--muted)]">{relationCopy}<Link className="ml-2 border-b border-[var(--blue)] pb-0.5 text-[10px] text-[var(--blue)]" href={letterHref(evidence)}>查看代表书信 ↗</Link></p>
        </aside>
      </div>
    </div>
  );
}

function MaterialOverview({ onOpenAll }: { onOpenAll: () => void }) {
  const recipients = DATA.recipientRows.slice(0, 8);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const allCounts = YEARS.map((year) => DATA.yearCounts.get(year) ?? 0);
  const recipientCounts = selectedRecipient
    ? YEARS.map((year) => DATA.recipientYearCounts.get(selectedRecipient)?.get(year) ?? 0)
    : [];

  const option = useMemo(() => ({
    animationDuration: 420,
    textStyle: { fontFamily: '"Noto Serif SC", "Songti SC", STSong, SimSun, serif' },
    grid: { left: 42, right: 18, top: 42, bottom: 68 },
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
        return `<b>${params[0]?.axisValue}年</b>${params.map((item) => `<div style="margin-top:4px">${item.seriesName}：${item.data}封</div>`).join("")}`;
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: YEARS.map(String),
      axisLine: { lineStyle: { color: "#cfc8ba" } },
      axisTick: { show: false },
      axisLabel: { color: "#625d63", fontSize: 11, interval: 3, margin: 16 },
    },
    yAxis: {
      type: "value",
      min: 0,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "rgba(81,78,70,.085)", type: "dashed" } },
      axisLabel: { color: "#7b757b", fontSize: 10 },
    },
    series: [
      {
        name: "全部书信",
        type: "line",
        data: allCounts,
        smooth: .18,
        showSymbol: false,
        lineStyle: { color: "#9a7c45", width: 2 },
        areaStyle: { color: "rgba(154,124,69,.09)" },
      },
      ...(selectedRecipient ? [{
        name: `致${selectedRecipient}`,
        type: "line",
        data: recipientCounts,
        smooth: .18,
        showSymbol: true,
        symbolSize: 5,
        lineStyle: { color: "#526b80", width: 2 },
        itemStyle: { color: "#526b80", borderColor: "#f8f6f0", borderWidth: 1 },
        areaStyle: { color: "rgba(82,107,128,.045)" },
      }] : []),
    ],
  }), [allCounts, recipientCounts, selectedRecipient]);

  const letterTicks = useMemo(() => {
    const byYear = new Map<number, Letter[]>();
    dataset.letters.forEach((letter) => {
      const year = Number.parseInt(letter.year ?? "", 10);
      if (year < START_YEAR || year > END_YEAR) return;
      byYear.set(year, [...(byYear.get(year) ?? []), letter]);
    });
    return [...byYear.entries()].flatMap(([year, letters]) => letters.map((letter, index) => {
      const spread = letters.length > 1 ? (index + .5) / letters.length - .5 : 0;
      return {
        letter,
        left: ((year - START_YEAR + spread * .72) / (END_YEAR - START_YEAR)) * 100,
        height: 5 + index % 4 * 2,
      };
    }));
  }, []);

  return (
    <div className="min-h-[500px] py-4">
      <section className="grid items-stretch border-y border-[var(--line-dark)] lg:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
        <article className="min-w-0 py-5 lg:pr-8">
          <header className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div><p className="text-[9px] tracking-[.13em] text-[var(--muted)]">横轴为公历年代</p><h3 className="mt-1 border-l-2 border-[var(--gold)] pl-3 text-[19px]">年代分布</h3></div>
            {selectedRecipient ? <button type="button" className="border-0 border-b border-[var(--blue)] bg-transparent pb-1 text-[10px] text-[var(--blue)]" onClick={() => setSelectedRecipient(null)}>已叠加：致{selectedRecipient} ×</button> : <span className="text-[10px] text-[var(--muted)]">点击右侧人物叠加年代曲线</span>}
          </header>
          <div className="relative mt-2 min-w-0">
            <ResponsiveEChart className="h-[410px] min-w-0" option={option} />
            <div className="pointer-events-none absolute bottom-[68px] left-[42px] right-[18px] h-5 border-b border-[var(--line-dark)]" aria-label="逐封书信年代刻度">
              {letterTicks.map(({ letter, left, height }) => (
                <Link
                  className={`pointer-events-auto absolute bottom-0 w-px -translate-x-1/2 transition hover:w-[2px] ${selectedRecipient && letter.recipient !== selectedRecipient ? "bg-[var(--line-dark)] opacity-20" : selectedRecipient ? "bg-[var(--blue)]" : "bg-[var(--gold)] opacity-65"}`}
                  href={letterHref(letter)}
                  key={letter.id}
                  style={{ left: `${left}%`, height }}
                  title={`${letter.year}年 · 致${letter.recipient}`}
                  aria-label={`${letter.year}年致${letter.recipient}的书信`}
                />
              ))}
            </div>
          </div>
          <p className="border-t border-[var(--line)] px-1 pt-3 text-[10px] leading-5 text-[var(--muted)]">曲线表示各年现存书信数量，每条短刻度对应一封年代明确的书信；年代未详材料不进入曲线。</p>
        </article>

        <aside className="flex min-h-[500px] flex-col border-t border-[var(--line)] py-5 lg:border-l lg:border-t-0 lg:border-[var(--line)] lg:pl-6">
          <header className="flex items-end justify-between border-b border-[var(--line)] pb-4">
            <div><p className="text-[9px] tracking-[.13em] text-[var(--muted)]">全部年代</p><h3 className="mt-1 border-l-2 border-[var(--gold)] pl-3 text-[19px]">主要通信对象</h3></div>
            <span className="text-[10px] text-[var(--muted)]">{dataset.letters.length}封</span>
          </header>
          <div className="grid grid-cols-[1fr_48px_56px] border-b border-[var(--line)] py-3 text-[9px] text-[var(--muted)]"><span>通信对象</span><span className="text-right">封数</span><span className="text-right">占比</span></div>
          <div>
            {recipients.map((recipient) => {
              const active = selectedRecipient === recipient.name;
              return (
                <button
                  type="button"
                  className={`grid min-h-[49px] w-full grid-cols-[1fr_48px_56px] items-center border-0 border-b border-[var(--line)] bg-transparent px-1 text-left transition ${active ? "bg-[rgba(82,107,128,.07)] text-[var(--blue)]" : "hover:bg-[rgba(255,254,249,.72)]"}`}
                  onClick={() => setSelectedRecipient(active ? null : recipient.name)}
                  aria-pressed={active}
                  key={recipient.name}
                >
                  <span className="text-[13px]">{recipient.name}</span><span className="text-right text-[11px] tabular-nums">{recipient.count}</span><span className="text-right text-[10px] tabular-nums text-[var(--muted)]">{percent(recipient.count, dataset.letters.length)}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-[var(--line-dark)] pt-4"><span className="text-[10px] text-[var(--muted)]">共{DATA.recipientRows.length}位通信对象</span><button type="button" className="border border-[var(--line-dark)] px-3 py-2 text-[10px] transition hover:border-[var(--purple)] hover:text-[var(--purple)]" onClick={onOpenAll}>查看全部</button></div>
        </aside>
      </section>
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
        {activeView === 0 && <MaterialOverview onOpenAll={onOpenRecipients} />}
        {activeView === 1 && <EventObjectStructure />}
        {activeView === 2 && <ContentActions />}
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
