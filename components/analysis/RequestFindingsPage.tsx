"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dataset } from "@/lib/data-adapter";
import type { ActMention, ActType, Letter } from "@/lib/types";
import clusterSource from "@/analysis-output/preliminary-request-path-clusters.json";
import academicSource from "@/analysis-output/academic-figure-statistics.json";

type PathCode = "A" | "B" | "C" | "D";
type FeatureKey =
  | "complexity"
  | "requestShare"
  | "serialRequest"
  | "firstRequestPosition"
  | "lastRequestPosition"
  | "postRequestContinuation"
  | "persuasionShare"
  | "informationShare"
  | "displayShare";

interface ClusterAssignment {
  letterId: string;
  number: string;
  year: string | null;
  recipient: string;
  requestCount: number;
  typeCode: PathCode;
  typeName: string;
  path: string;
  collapsedPath: string;
}

interface ClusterType {
  code: PathCode;
  name: string;
  letterCount: number;
  requestCount: number;
}

interface FeatureStat {
  mean: number;
  meanCi95: { lower: number; upper: number };
  standardizedMean: number;
  standardizedMeanCi95: { lower: number; upper: number };
}

interface AcademicType {
  code: PathCode;
  name: string;
  letterCount: number;
  corpusShare: number;
  assignmentStability: {
    featureWeightPerturbation: number;
    eightyPercentSubsampling: number;
  };
  features: Record<FeatureKey, FeatureStat>;
}

interface PersonProportion {
  person: string;
  typeCode: PathCode;
  typeName: string;
  count: number;
  total: number;
  proportion: number;
  proportionCi95: { lower: number; upper: number };
}

interface ControlledModel {
  expected: number;
  deltaPercentagePoints: number;
  oddsRatio: number;
  oddsRatioCi95: { lower: number | null; upper: number | null };
  permutationP: number;
  fdrQ: number;
}

interface ControlledEffect {
  person: string;
  typeCode: PathCode;
  typeName: string;
  totalLetters: number;
  observed: number;
  domainAdjusted: ControlledModel;
  domainEraAdjusted: ControlledModel;
}

const clustering = clusterSource as unknown as {
  corpus: { requestBearingLetters: number; requestInstances: number };
  types: ClusterType[];
  assignments: ClusterAssignment[];
};

const academic = academicSource as unknown as {
  materialPassport: {
    featureIntervals: string;
    personIntervals: string;
    adjustedEffectIntervals: string;
  };
  featureStatistics: { types: AcademicType[] };
  personProportions: { rows: PersonProportion[] };
  controlledEffects: ControlledEffect[];
};

const ACTION_LABELS: Record<ActType, string> = {
  INF: "告知",
  PRS: "说服",
  DSP: "展示",
  REQ: "请求",
  MNT: "维系",
  NEG: "协商",
  INS: "训诫",
};

const TYPE_ORDER: PathCode[] = ["A", "B", "C", "D"];
const PEOPLE_ORDER = ["松崎鹤雄", "缪荃孙", "孙毓修", "夏敬观", "易培基"];
const TYPE_ACCENTS: Record<PathCode, string> = {
  A: "var(--blue)",
  B: "var(--gold)",
  C: "var(--green)",
  D: "var(--red)",
};

const PATH_META: Record<
  PathCode,
  {
    short: string;
    description: string;
    keyFinding: string;
    keyValue: string;
    motif: string[];
    featureOrder: FeatureKey[];
  }
> = {
  A: {
    short: "请求后置",
    description: "先交代人物、事情或书籍背景，再提出需要对方完成的行动。",
    keyFinding: "请求通常在铺陈之后出现",
    keyValue: "首次请求平均位于全信72.5%处",
    motif: ["告知", "说明", "请求"],
    featureOrder: ["firstRequestPosition", "informationShare", "postRequestContinuation", "persuasionShare"],
  },
  B: {
    short: "论议收束",
    description: "经过评价、论议或方案取舍，最后把讨论收束为请求。",
    keyFinding: "讨论和说服最为集中",
    keyValue: "说服行动平均占30.7%",
    motif: ["告知", "论议", "请求"],
    featureOrder: ["complexity", "persuasionShare", "firstRequestPosition", "postRequestContinuation"],
  },
  C: {
    short: "请求前置",
    description: "请求较早出现，后文继续补充事实、理由或判断。",
    keyFinding: "提出请求以后仍继续展开",
    keyValue: "请求后仍保留62.6%的篇幅",
    motif: ["请求", "继续说明", "论议"],
    featureOrder: ["firstRequestPosition", "postRequestContinuation", "persuasionShare", "requestShare"],
  },
  D: {
    short: "请求成组",
    description: "多项请求或问询在信中连续出现，形成一组需要办理的事项。",
    keyFinding: "多个请求经常连续成组",
    keyValue: "连续请求程度达到87.7%",
    motif: ["事情", "请求·请求", "回收"],
    featureOrder: ["serialRequest", "requestShare", "firstRequestPosition", "postRequestContinuation"],
  },
};

const FEATURE_LABELS: Record<FeatureKey, string> = {
  complexity: "结构复杂度",
  requestShare: "请求占比",
  serialRequest: "连续请求",
  firstRequestPosition: "请求出现位置",
  lastRequestPosition: "请求结束位置",
  postRequestContinuation: "请求后展开",
  persuasionShare: "说服占比",
  informationShare: "告知占比",
  displayShare: "展示占比",
};

const CONTROL_HIGHLIGHTS: Partial<Record<PathCode, string>> = {
  B: "夏敬观",
  C: "孙毓修",
  D: "易培基",
};

const CURATED_TYPE_LETTERS: Record<PathCode, string[]> = {
  A: ["153_1911_缪荃孙", "187_1919_夏敬观", "257_0_杨树达"],
  B: ["197_1919_夏敬观", "099_1917_松崎鹤雄", "196_1919_夏敬观"],
  C: ["162_1913_缪荃孙", "049_1913_松崎鹤雄", "300_1908_孙毓修"],
  D: ["247_1920_孙毓修", "120_1920_松崎鹤雄", "006_1925_易培基"],
};

const CURATED_PAIR_LETTERS: Record<string, string[]> = {
  "易培基-D": ["001_1923_易培基", "002_1923_易培基", "006_1925_易培基"],
  "夏敬观-B": ["189_1919_夏敬观", "197_1919_夏敬观", "198_1919_夏敬观"],
  "孙毓修-C": ["238_0_孙毓修", "246_1920_孙毓修", "304_0_孙毓修"],
};

function percent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function decimal(value: number | null | undefined, digits = 2) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);
}

function clip(text: string | undefined, max = 82) {
  const clean = (text ?? "").replace(/\s+/g, "");
  if (!clean) return "原文暂缺";
  return clean.length > max ? `${clean.slice(0, max)}……` : clean;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function zPosition(value: number) {
  return ((clamp(value, -3, 3) + 3) / 6) * 100;
}

function proportionPosition(value: number) {
  return (clamp(value, 0, 0.8) / 0.8) * 100;
}

function formatFeatureValue(feature: FeatureKey, value: number) {
  return feature === "complexity" ? value.toFixed(2) : percent(value);
}

function collapsedActs(letterId: string) {
  const acts = [...(dataset.actsByLetter[letterId] ?? [])]
    .filter((act) => act.type !== "MNT")
    .sort((a, b) => a.start - b.start);
  return acts.filter(
    (act, index) => index === 0 || act.type !== acts[index - 1].type,
  );
}

function firstRequest(letterId: string) {
  return [...(dataset.actsByLetter[letterId] ?? [])]
    .filter((act) => act.type === "REQ")
    .sort((a, b) => a.start - b.start)[0] ?? null;
}

function sourceHref(letter: Letter, request: ActMention | null) {
  if (!request) return `/letter/${encodeURIComponent(letter.id)}`;
  const params = new URLSearchParams({
    q: request.originalText,
    scope: "fulltext",
    at: String(request.start),
    act: request.id,
  });
  return `/letter/${encodeURIComponent(letter.id)}?${params.toString()}`;
}

function PathMotif({ typeCode, small = false }: { typeCode: PathCode; small?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2" aria-label={`${PATH_META[typeCode].short}结构`}>
      {PATH_META[typeCode].motif.map((item, index) => (
        <span className="contents" key={`${typeCode}-${item}`}>
          {index > 0 && <span className="text-[10px] text-[var(--line-dark)]">→</span>}
          <span className={`${item.includes("请求") ? "text-[var(--purple)]" : "text-[var(--muted)]"} whitespace-nowrap ${small ? "text-[10px]" : "text-[12px]"}`}>
            {item}
          </span>
        </span>
      ))}
    </div>
  );
}

function PetalButton({
  code,
  position,
  onPreview,
  onChoose,
}: {
  code: PathCode;
  position: "tl" | "tr" | "bl" | "br";
  onPreview: (code: PathCode | null) => void;
  onChoose: (code: PathCode) => void;
}) {
  const type = academic.featureStatistics.types.find((item) => item.code === code)!;
  const placement = {
    tl: "bottom-1/2 right-1/2 mb-2 mr-2 pr-20 text-right items-end",
    tr: "bottom-1/2 left-1/2 mb-2 ml-2 pl-20 text-left items-start",
    bl: "right-1/2 top-1/2 mr-2 mt-2 pr-20 text-right items-end",
    br: "left-1/2 top-1/2 ml-2 mt-2 pl-20 text-left items-start",
  }[position];
  const radius = {
    tl: "75% 18% 55% 18%",
    tr: "18% 75% 18% 55%",
    bl: "18% 55% 18% 75%",
    br: "55% 18% 75% 18%",
  }[position];
  return (
    <button
      className={`absolute flex h-[184px] w-[min(330px,42vw)] flex-col justify-center border-0 bg-[rgba(81,78,70,.035)] px-8 py-6 transition-[background,transform] duration-200 hover:z-10 hover:scale-[1.025] hover:bg-[rgba(79,103,130,.08)] focus-visible:z-10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--blue)] ${placement}`}
      style={{ borderRadius: radius }}
      type="button"
      onMouseEnter={() => onPreview(code)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(code)}
      onBlur={() => onPreview(null)}
      onClick={() => onChoose(code)}
      aria-label={`查看${type.name}`}
    >
      <span className="text-[10px] tracking-[.14em]" style={{ color: TYPE_ACCENTS[code] }}>{code} · {type.letterCount}封 · {percent(type.corpusShare)}</span>
      <b className="mt-2 block text-[20px] font-normal tracking-[.04em]">{type.name}</b>
      <span className="mt-2 font-sans text-[10px] leading-5 text-[var(--muted)]">{PATH_META[code].keyValue}</span>
      <span className="mt-3"><PathMotif typeCode={code} small /></span>
    </button>
  );
}

function TypeOverview({
  hovered,
  onPreview,
  onChoose,
}: {
  hovered: PathCode | null;
  onPreview: (code: PathCode | null) => void;
  onChoose: (code: PathCode) => void;
}) {
  const preview = hovered ? academic.featureStatistics.types.find((type) => type.code === hovered)! : null;
  return (
    <section className="py-7">
      <header className="mx-auto max-w-[900px] text-center">
        <p className="text-[10px] tracking-[.18em] text-[var(--blue)]">通信路径纵览</p>
        <h1 className="mt-3 text-[30px] font-normal tracking-[.06em] sm:text-[34px]">叶德辉怎样提出请求？</h1>
        <p className="mx-auto mt-3 max-w-[620px] font-sans text-[11px] leading-6 text-[var(--muted)]">在178封含有请求的书信中，四种写法反复出现。选择一种，继续查看它的结构、常见通信对象和书信原文。</p>
      </header>

      <div className="relative mx-auto mt-6 hidden h-[400px] max-w-[800px] md:block">
        <PetalButton code="A" position="tl" onPreview={onPreview} onChoose={onChoose} />
        <PetalButton code="B" position="tr" onPreview={onPreview} onChoose={onChoose} />
        <PetalButton code="C" position="bl" onPreview={onPreview} onChoose={onChoose} />
        <PetalButton code="D" position="br" onPreview={onPreview} onChoose={onChoose} />
        <div className="absolute left-1/2 top-1/2 z-20 grid size-[148px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[var(--line-dark)] bg-[var(--paper)] text-center shadow-[0_8px_28px_rgba(39,36,42,.06)]">
          {preview ? (
            <div className="px-4">
              <span className="text-[10px]" style={{ color: TYPE_ACCENTS[preview.code] }}>{preview.code}</span>
              <b className="mt-1 block text-[15px] font-normal">{PATH_META[preview.code].short}</b>
              <small className="mt-2 block font-sans text-[9px] leading-4 text-[var(--muted)]">{PATH_META[preview.code].keyFinding}</small>
            </div>
          ) : (
            <div>
              <span className="text-[23px] text-[var(--purple)]">请求</span>
              <small className="mt-2 block font-sans text-[9px] text-[var(--muted)]">悬停预览<br />点击进入</small>
            </div>
          )}
        </div>
      </div>

      <div className="mt-7 grid gap-3 md:hidden">
        {TYPE_ORDER.map((code) => {
          const type = academic.featureStatistics.types.find((item) => item.code === code)!;
          return (
            <button className="grid grid-cols-[1fr_auto] items-center border-0 border-b border-[var(--line)] bg-transparent py-4 text-left" type="button" onClick={() => onChoose(code)} key={code}>
              <span><small className="text-[10px]" style={{ color: TYPE_ACCENTS[code] }}>{code}</small><b className="ml-3 text-[17px] font-normal">{type.name}</b><small className="mt-2 block font-sans text-[10px] text-[var(--muted)]">{PATH_META[code].keyValue}</small></span>
              <span className="text-right text-[11px] leading-5 text-[var(--muted)]">{type.letterCount}封<br />{percent(type.corpusShare)} →</span>
            </button>
          );
        })}
      </div>

      <div className="mx-auto mt-5 flex max-w-[800px] items-center justify-between border-t border-[var(--line)] pt-4 font-sans text-[10px] text-[var(--muted)]">
        <span>四类合计 {clustering.corpus.requestBearingLetters} 封书信 · {clustering.corpus.requestInstances} 个请求实例</span>
        <details className="relative text-right">
          <summary className="cursor-pointer text-[var(--ink)] hover:text-[var(--purple)]">研究说明 ＋</summary>
          <div className="absolute bottom-full right-0 z-30 mb-2 w-[360px] bg-[var(--surface)] p-4 text-left leading-5 shadow-[0_12px_30px_rgba(39,36,42,.12)]">
            四类由整封书信的行动顺序、请求位置与行动占比共同归纳。例行结尾套语未参与分类；类型稳定性与完整计算口径可在进入类型后查看。
          </div>
        </details>
      </div>
    </section>
  );
}

function StructurePanel({ type }: { type: AcademicType }) {
  const features = PATH_META[type.code].featureOrder;
  return (
    <section className="flex h-full min-w-0 flex-col">
      <p className="text-[10px] tracking-[.13em] text-[var(--blue)]">01 · 这种写法有什么特点？</p>
      <h3 className="mt-2 text-[22px] font-normal">与全部书信相比</h3>
      <p className="mt-2 font-sans text-[10px] leading-5 text-[var(--muted)]">圆点越靠右，说明这一特点在当前类型中越突出；线段表示样本可能范围。</p>
      <div className="mt-4 flex flex-1 flex-col justify-between">
        {features.map((feature) => {
          const stats = type.features[feature];
          const left = zPosition(stats.standardizedMeanCi95.lower);
          const right = zPosition(stats.standardizedMeanCi95.upper);
          const point = zPosition(stats.standardizedMean);
          return (
            <div key={feature}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12px]">{FEATURE_LABELS[feature]}</span>
                <span className="font-sans text-[9px] text-[var(--muted)]">{formatFeatureValue(feature, stats.mean)}</span>
              </div>
              <div className="group relative mt-2 h-7" title={`${FEATURE_LABELS[feature]}：${formatFeatureValue(feature, stats.mean)}；范围${formatFeatureValue(feature, stats.meanCi95.lower)}—${formatFeatureValue(feature, stats.meanCi95.upper)}`}>
                {[-2, -1, 0, 1, 2].map((tick) => <i className={`absolute inset-y-0 w-px not-italic ${tick === 0 ? "bg-[var(--line-dark)]" : "bg-[var(--line)] opacity-60"}`} style={{ left: `${zPosition(tick)}%` }} key={tick} />)}
                <i className="absolute top-1/2 h-px -translate-y-1/2 bg-[var(--ink)] not-italic" style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%` }} />
                <i className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--blue)] not-italic" style={{ left: `${point}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between border-t border-[var(--line)] pt-2 font-sans text-[9px] text-[var(--muted)]"><span>低于平均</span><span>全部平均</span><span>高于平均</span></div>
      <details className="mt-auto border-t border-[var(--line)] pt-3 font-sans text-[10px] text-[var(--muted)]">
        <summary className="w-fit cursor-pointer text-[var(--ink)] hover:text-[var(--purple)]">查看类型稳定性</summary>
        <p className="mt-2 leading-5">改变指标权重时保留{percent(type.assignmentStability.featureWeightPerturbation)}；抽取80%书信重新分类时保留{percent(type.assignmentStability.eightyPercentSubsampling)}。</p>
      </details>
    </section>
  );
}

function PeoplePanel({
  type,
  selectedPerson,
  onSelectPerson,
}: {
  type: AcademicType;
  selectedPerson: string | null;
  onSelectPerson: (person: string | null) => void;
}) {
  const rows = PEOPLE_ORDER.map((person) =>
    academic.personProportions.rows.find(
      (row) => row.person === person && row.typeCode === type.code,
    )!,
  );
  const highlightedPerson = CONTROL_HIGHLIGHTS[type.code];
  const effect = highlightedPerson
    ? academic.controlledEffects.find(
        (row) => row.person === highlightedPerson && row.typeCode === type.code,
      )
    : null;
  return (
    <section className="flex h-full min-w-0 flex-col border-t border-[var(--line)] pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
      <p className="text-[10px] tracking-[.13em] text-[var(--green)]">02 · 谁更常这样写？</p>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <h3 className="text-[22px] font-normal">五位主要通信对象</h3>
        {selectedPerson && <button className="border-0 bg-transparent font-sans text-[9px] text-[var(--muted)] hover:text-[var(--purple)]" type="button" onClick={() => onSelectPerson(null)}>取消人物筛选</button>}
      </div>
      <p className="mt-2 font-sans text-[10px] leading-5 text-[var(--muted)]">点是实际比例，线段表示样本可能范围；蓝灰虚线是这一类型的总体比例。</p>
      <div className="mt-3 flex flex-1 flex-col">
        {rows.map((row) => {
          const selected = selectedPerson === row.person;
          const left = proportionPosition(row.proportionCi95.lower);
          const right = proportionPosition(row.proportionCi95.upper);
          const point = proportionPosition(row.proportion);
          return (
            <button className={`group grid min-h-0 flex-1 w-full grid-cols-[92px_minmax(0,1fr)] items-center gap-3 border-0 border-b bg-transparent py-1.5 text-left ${selected ? "border-[var(--gold)]" : "border-[var(--line)]"}`} type="button" onClick={() => onSelectPerson(row.person)} key={row.person}>
              <span className={`${selected ? "text-[var(--gold)]" : "text-[var(--ink)]"} text-[12px]`}>{row.person}<small className="ml-1 font-sans text-[9px] text-[var(--muted)]">{row.total}封</small></span>
              <span className="relative h-7">
                {[0, 0.4, 0.8].map((tick) => <i className="absolute inset-y-0 w-px bg-[var(--line)] not-italic" style={{ left: `${proportionPosition(tick)}%` }} key={tick} />)}
                <i className="absolute inset-y-0 w-px border-l border-dashed border-[var(--blue)] not-italic opacity-60" style={{ left: `${proportionPosition(type.corpusShare)}%` }} />
                <i className="absolute top-1/2 h-px -translate-y-1/2 bg-[var(--ink)] not-italic" style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%` }} />
                <i className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border not-italic ${selected ? "border-[var(--gold)] bg-[var(--gold)]" : "border-[var(--ink)] bg-[var(--paper)]"}`} style={{ left: `${point}%` }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap bg-[var(--ink)] px-2 py-1 font-sans text-[9px] text-white group-hover:block">{row.count}/{row.total} · {percent(row.proportion)} · 范围{percent(row.proportionCi95.lower)}—{percent(row.proportionCi95.upper)}</span>
              </span>
            </button>
          );
        })}
        <div className="ml-[105px] flex justify-between pt-2 font-sans text-[9px] text-[var(--muted)]"><span>0</span><span>40%</span><span>80%</span></div>
      </div>

      <div className="mt-auto border-t border-[var(--line-dark)] pt-4">
        {effect ? (
          <>
            <p className="text-[12px] leading-6"><span className="text-[var(--green)]">{highlightedPerson}</span>在同类事务中仍较多使用{type.name}；把通信年代也考虑进去后，这个差异不再稳定。</p>
            <details className="mt-2 font-sans text-[10px] text-[var(--muted)]">
              <summary className="w-fit cursor-pointer text-[var(--ink)] hover:text-[var(--purple)]">查看校验数字</summary>
              <p className="mt-2 leading-5">只比较同类事务：OR {decimal(effect.domainAdjusted.oddsRatio)}，95%区间 {decimal(effect.domainAdjusted.oddsRatioCi95.lower)}—{decimal(effect.domainAdjusted.oddsRatioCi95.upper)}，FDR q={decimal(effect.domainAdjusted.fdrQ, 3)}。再考虑时期：OR {decimal(effect.domainEraAdjusted.oddsRatio)}，区间 {decimal(effect.domainEraAdjusted.oddsRatioCi95.lower)}—{decimal(effect.domainEraAdjusted.oddsRatioCi95.upper)}。</p>
            </details>
          </>
        ) : (
          <p className="text-[12px] leading-6 text-[var(--muted)]">目前没有发现值得单列的人物倾向。这里的人物比例主要用于选择书信，不解释为固定写信习惯。</p>
        )}
      </div>
    </section>
  );
}

function evidenceIds(typeCode: PathCode, person: string | null) {
  const curated = person ? CURATED_PAIR_LETTERS[`${person}-${typeCode}`] : CURATED_TYPE_LETTERS[typeCode];
  const eligible = clustering.assignments.filter(
    (row) => row.typeCode === typeCode && (!person || row.recipient === person),
  );
  return [...(curated ?? []), ...eligible.map((row) => row.letterId)]
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, 3);
}

function EvidencePanel({
  type,
  person,
}: {
  type: AcademicType;
  person: string | null;
}) {
  const letterMap = useMemo(
    () => new Map(dataset.letters.map((letter) => [letter.id, letter])),
    [],
  );
  const ids = evidenceIds(type.code, person);
  return (
    <section className="flex h-full min-w-0 flex-col border-t border-[var(--line)] pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
      <p className="text-[10px] tracking-[.13em] text-[var(--gold)]">03 · 哪些书信支持这一观察？</p>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <h3 className="text-[21px] font-normal">{person ? `致${person}` : "代表书信"}</h3>
        <span className="font-sans text-[9px] text-[var(--muted)]">先看3封</span>
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        {ids.map((id, index) => {
          const letter = letterMap.get(id);
          if (!letter) return null;
          const request = firstRequest(id);
          const acts = collapsedActs(id).slice(0, 5);
          return (
            <article className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden border-b border-[var(--line)] py-2" key={id}>
              <div className="grid grid-cols-[1fr_auto] items-baseline gap-3 font-sans text-[10px] text-[var(--muted)]">
                <span>{String(index + 1).padStart(2, "0")} · 第{letter.number}通 · {letter.year ?? "年代未详"}</span>
                <span className="text-[var(--ink)]">致{letter.recipient}</span>
              </div>
              <div className="mt-2 grid grid-cols-[118px_minmax(0,1fr)] items-start gap-3">
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {acts.map((act, actIndex) => (
                    <span className="contents" key={act.id}>
                      {actIndex > 0 && <span className="text-[10px] text-[var(--line-dark)]">→</span>}
                      <span className={`text-[10px] ${act.type === "REQ" ? "border-b border-[var(--purple)] text-[var(--purple)]" : "text-[var(--muted)]"}`}>{ACTION_LABELS[act.type]}</span>
                    </span>
                  ))}
                </div>
                <Link
                  className="line-clamp-2 text-[14px] leading-5 text-[var(--ink)] transition-colors hover:text-[var(--purple)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)]"
                  href={sourceHref(letter, request)}
                  aria-label={`阅读第${letter.number}通书信全文`}
                  title="点击原文进入书信全文"
                >
                  “{clip(request?.originalText, 52)}”
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TypeWorkbench({
  typeCode,
  selectedPerson,
  onBack,
  onChangeType,
  onSelectPerson,
}: {
  typeCode: PathCode;
  selectedPerson: string | null;
  onBack: () => void;
  onChangeType: (code: PathCode) => void;
  onSelectPerson: (person: string | null) => void;
}) {
  const type = academic.featureStatistics.types.find((item) => item.code === typeCode)!;
  return (
    <section className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line-dark)] pb-3">
        <button className="border-0 border-b border-[var(--line-dark)] bg-transparent pb-1 text-[11px] text-[var(--muted)] hover:border-[var(--purple)] hover:text-[var(--purple)]" type="button" onClick={onBack}>查看四种类型</button>
        <nav className="flex items-end gap-5" aria-label="切换通信路径类型">
          {TYPE_ORDER.map((code) => (
            <button
              className={`min-w-5 border-0 border-b bg-transparent px-0 pb-1.5 pt-1 text-[15px] leading-none transition-colors ${code === typeCode ? "border-current" : "border-transparent text-[var(--muted)] hover:border-[var(--line-dark)] hover:text-[var(--ink)]"}`}
              style={code === typeCode ? { color: TYPE_ACCENTS[code] } : undefined}
              type="button"
              aria-label={`切换至${code}类：${PATH_META[code].short}`}
              aria-pressed={code === typeCode}
              onClick={() => onChangeType(code)}
              key={code}
            >
              {code}
            </button>
          ))}
        </nav>
      </div>

      <header className="grid gap-4 border-b border-[var(--line)] py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div><p className="text-[10px] tracking-[.14em]" style={{ color: TYPE_ACCENTS[type.code] }}>{type.code} · {PATH_META[type.code].short}</p><h1 className="mt-2 text-[29px] font-normal tracking-[.05em]">{type.name}</h1><p className="mt-2 max-w-[720px] text-[13px] leading-6">{PATH_META[type.code].description}</p></div>
        <div className="lg:text-right"><p className="font-sans text-[10px] text-[var(--muted)]">{type.letterCount}封 · 占全部{percent(type.corpusShare)}</p><div className="mt-3 flex justify-end"><PathMotif typeCode={type.code} /></div></div>
      </header>

      <div className="grid items-stretch gap-7 py-3 lg:grid-cols-[.9fr_1.05fr_1.05fr]">
        <StructurePanel type={type} />
        <PeoplePanel type={type} selectedPerson={selectedPerson} onSelectPerson={onSelectPerson} />
        <EvidencePanel type={type} person={selectedPerson} />
      </div>
    </section>
  );
}

export function RequestAnalysisView({ initialType = null }: { initialType?: PathCode | null }) {
  const [activeType, setActiveType] = useState<PathCode | null>(initialType);
  const [hoveredType, setHoveredType] = useState<PathCode | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  function chooseType(code: PathCode) {
    setActiveType(code);
    setSelectedPerson(null);
    setHoveredType(null);
  }

  return (
    <div className="font-serif">
      {activeType ? (
        <TypeWorkbench typeCode={activeType} selectedPerson={selectedPerson} onBack={() => { setActiveType(null); setSelectedPerson(null); }} onChangeType={chooseType} onSelectPerson={setSelectedPerson} />
      ) : (
        <TypeOverview hovered={hoveredType} onPreview={setHoveredType} onChoose={chooseType} />
      )}
    </div>
  );
}

export function RequestFindingsPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-[var(--paper)] pb-4 font-serif">
      <div className="site-container">
        <RequestAnalysisView />
      </div>
    </main>
  );
}
