"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ReactEChartsCore from "echarts-for-react/esm/core";
import { dataset } from "@/lib/data-adapter";
import { echarts } from "@/lib/analysis/echarts-builder";
import type { ActMention, ActType, EventType, Letter } from "@/lib/types";
import type { PathCode } from "@/lib/request-types";
import { TYPE_ACCENTS, TYPE_ORDER, TYPE_SLUG_REVERSE } from "@/lib/request-types";
import clusterSource from "@/analysis-output/preliminary-request-path-clusters.json";
import academicSource from "@/analysis-output/academic-figure-statistics.json";

// ── 类型 ────────────────────────────────────────────────────────

type FeatureKey =
  | "complexity" | "requestShare" | "serialRequest"
  | "firstRequestPosition" | "lastRequestPosition"
  | "postRequestContinuation" | "persuasionShare"
  | "informationShare" | "displayShare";
type StepType = ActType | "NONE";
type Position = 0 | 1 | 3 | 4;

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

interface RequestEpisode {
  id: string;
  letter: Letter;
  request: ActMention;
  recipient: string;
  domain: EventType | "UNK";
  steps: [
    { type: StepType; act: ActMention | null },
    { type: StepType; act: ActMention | null },
    { type: StepType; act: ActMention | null },
    { type: StepType; act: ActMention | null },
    { type: StepType; act: ActMention | null }
  ];
  pathKey: string;
}

// ── 解析静态数据 ────────────────────────────────────────────────

const clustering = clusterSource as unknown as {
  corpus: { allLetters: number; requestBearingLetters: number; requestInstances: number };
  types: ClusterType[];
  assignments: { letterId: string; number: string; year: string | null; recipient: string; requestCount: number; typeCode: PathCode; typeName: string; path: string; collapsedPath: string }[];
};

const academic = academicSource as unknown as {
  materialPassport: {
    featureIntervals: string;
    personIntervals: string;
    adjustedEffectIntervals: string;
  };
  featureStatistics: { types: AcademicType[] };
  personProportions: { rows: { person: string; typeCode: PathCode; typeName: string; count: number; total: number; proportion: number; proportionCi95: { lower: number; upper: number } }[] };
  controlledEffects: { person: string; typeCode: PathCode; typeName: string; totalLetters: number; observed: number; domainAdjusted: { expected: number; deltaPercentagePoints: number; oddsRatio: number; oddsRatioCi95: { lower: number | null; upper: number | null }; permutationP: number; fdrQ: number }; domainEraAdjusted: { expected: number; deltaPercentagePoints: number; oddsRatio: number; oddsRatioCi95: { lower: number | null; upper: number | null }; permutationP: number; fdrQ: number } }[];
};

// ── 常量 ────────────────────────────────────────────────────────

const PATH_META: Record<PathCode, {
  short: string; description: string; keyFinding: string; keyValue: string;
  motif: string[]; featureOrder: FeatureKey[];
}> = {
  A: { short: "请求后置", description: "先交代人物、事情或书籍背景，再提出需要对方完成的行动。这类书信通常以告知、说明作为主体，请求出现在信件后半段。判断标准：首次请求位置位于全信60%之后，且告知类行动占全部非维系行动的一半以上。", keyFinding: "请求通常在铺陈之后出现", keyValue: "首次请求平均位于全信72.5%处", motif: ["告知", "说明", "请求"], featureOrder: ["firstRequestPosition", "informationShare", "postRequestContinuation", "persuasionShare"] },
  B: { short: "论议收束", description: "经过评价、论议或方案取舍，最后把讨论收束为请求。这类书信中说服性行动占比明显高于其他类型，论证与请求形成紧密的因果链。判断标准：说服行动占比超过20%，且论证部分集中在请求之前。", keyFinding: "讨论和说服最为集中", keyValue: "说服行动平均占30.7%", motif: ["告知", "论议", "请求"], featureOrder: ["complexity", "persuasionShare", "firstRequestPosition", "postRequestContinuation"] },
  C: { short: "请求前置", description: "请求较早出现，后文继续补充事实、理由或判断。此类书信中，叶德辉会先提出核心请求，随后展开详细说明、论证或提供更多背景信息。判断标准：首次请求位于全信40%之前，且请求后仍有大量篇幅。", keyFinding: "提出请求以后仍继续展开", keyValue: "请求后仍保留62.6%的篇幅", motif: ["请求", "继续说明", "论议"], featureOrder: ["firstRequestPosition", "postRequestContinuation", "persuasionShare", "requestShare"] },
  D: { short: "请求成组", description: "多项请求或问询在信中连续出现，形成一组需要办理的事项。请求行动高度聚集，往往在同一段落内连续提出多个互相关联的请托。判断标准：连续请求程度指标超过0.5，且请求行动之间的间隔极短。", keyFinding: "多个请求经常连续成组", keyValue: "连续请求程度达到87.7%", motif: ["事情", "请求·请求", "回收"], featureOrder: ["serialRequest", "requestShare", "firstRequestPosition", "postRequestContinuation"] },
};

const STEP_LABELS: Record<StepType, string> = {
  AST: "陈述", DIR: "连续请求", EXP: "表达", COM: "承诺", NONE: "无行动",
};

const FEATURE_LABELS: Record<FeatureKey, string> = {
  complexity: "结构复杂度", requestShare: "请求占比", serialRequest: "连续请求",
  firstRequestPosition: "请求出现位置", lastRequestPosition: "请求结束位置",
  postRequestContinuation: "请求后展开", persuasionShare: "说服占比",
  informationShare: "告知占比", displayShare: "展示占比",
};

const CURATED_TYPE_LETTERS: Record<PathCode, string[]> = {
  A: ["153_1911_缪荃孙", "187_1919_夏敬观", "257_0_杨树达"],
  B: ["197_1919_夏敬观", "099_1917_松崎鹤雄", "196_1919_夏敬观"],
  C: ["162_1913_缪荃孙", "049_1913_松崎鹤雄", "300_1908_孙毓修"],
  D: ["247_1920_孙毓修", "120_1920_松崎鹤雄", "006_1925_易培基"],
};

const ACTION_MEANINGS: Record<StepType, string> = {
  AST: "交代事实、进展或背景", DIR: "连续提出另一项请求", EXP: "维持关系或表达关切",
  COM: "协商条件与处理方式", NONE: "没有出现其他已标注行动",
};

// ── 工具函数 ────────────────────────────────────────────────────

function pct(count: number, total: number) {
  return total ? `${Math.round((count / total) * 100)}%` : "—";
}

function percent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function clip(text: string | undefined, max = 82) {
  const clean = (text ?? "").replace(/\s+/g, "");
  if (!clean) return "原文暂缺";
  return clean.length > max ? `${clean.slice(0, max)}……` : clean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function zPos(value: number) {
  return ((clamp(value, -3, 3) + 3) / 6) * 100;
}

function formatFeatureValue(feature: FeatureKey, value: number) {
  return feature === "complexity" ? value.toFixed(2) : percent(value);
}

function linkedDomain(letterId: string, request: ActMention): EventType | "UNK" {
  const events = dataset.eventsByLetter[letterId] ?? [];
  for (const link of request.eventLinks) {
    const event = events.find((c) => c.id === link.eventId);
    if (event) return event.type;
  }
  const domain = request.contentDomains.find((item) =>
    ["DOM-BIB", "DOM-ACA", "DOM-SOC", "DOM-POL", "DOM-FAM"].includes(item),
  );
  return domain ? (domain.slice(4) as EventType) : "UNK";
}

function makeEpisodes(): RequestEpisode[] {
  const letterMap = new Map(dataset.letters.map((l) => [l.id, l]));
  return Object.entries(dataset.actsByLetter).flatMap(([letterId, rawActs]) => {
    const letter = letterMap.get(letterId);
    if (!letter) return [];
    const acts = [...rawActs].sort((a, b) => a.start - b.start);
    return acts.flatMap((request, index) => {
      if (request.type !== "DIR") return [];
      const step = (offset: number) => {
        const act = acts[index + offset] ?? null;
        return { type: (act?.type ?? "NONE") as StepType, act };
      };
      const steps: RequestEpisode["steps"] = [step(-2), step(-1), { type: "DIR", act: request }, step(1), step(2)];
      return [{
        id: request.id, letter, request, recipient: letter.recipient,
        domain: linkedDomain(letterId, request), steps,
        pathKey: steps.map((s) => s.type).join(">"),
      }];
    });
  });
}

const ALL_EPISODES = makeEpisodes();

function sourceHref(episode: RequestEpisode) {
  const params = new URLSearchParams({
    q: episode.request.originalText, scope: "fulltext",
    at: String(episode.request.start), act: episode.request.id,
  });
  return `/letter/${encodeURIComponent(episode.letter.id)}?${params.toString()}`;
}

// ── 复用组件 ────────────────────────────────────────────────────

function PathMotif({ typeCode, small = false }: { typeCode: PathCode; small?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2" aria-label={`${PATH_META[typeCode].short}结构`}>
      {PATH_META[typeCode].motif.map((item, i) => (
        <span className="contents" key={`${typeCode}-${item}`}>
          {i > 0 && <span className="text-[10px] text-[var(--line-dark)]">→</span>}
          <span className={`${item.includes("请求") ? "text-[var(--purple)]" : "text-[var(--muted)]"} whitespace-nowrap ${small ? "text-[10px]" : "text-[12px]"}`}>{item}</span>
        </span>
      ))}
    </div>
  );
}

function StructureStrip({ episodes, compact = false }: { episodes: RequestEpisode[]; compact?: boolean }) {
  const ep = episodes[0];
  const avgLengths = ep.steps.map((_, si) => {
    const total = episodes.reduce((sum, item) => {
      const text = item.steps[si].act?.originalText ?? "";
      return sum + text.replace(/\s+/g, "").length;
    }, 0);
    return Math.round(total / Math.max(episodes.length, 1));
  });
  return (
    <div>
      <div className={`flex min-w-0 gap-px overflow-hidden bg-[var(--paper)] ${compact ? "h-[44px]" : "h-[58px]"}`} aria-label="行动结构">
        {ep.steps.map((step, i) => {
          const isReq = i === 2;
          const label = isReq ? "请求" : step.type === "NONE" ? "—" : STEP_LABELS[step.type];
          const len = avgLengths[i];
          const weight = Math.max(len, step.type === "NONE" ? 5 : 8);
          return (
            <span className={`flex min-w-[44px] flex-col items-center justify-center px-1 text-center ${isReq ? "bg-[rgba(255,254,249,.96)] text-[var(--purple)] outline outline-1 -outline-offset-1 outline-[var(--purple)]" : step.type === "NONE" ? "bg-[rgba(81,78,70,.035)] text-[var(--muted)]" : "bg-[rgba(81,78,70,.09)] text-[var(--ink)]"}`} style={{ flexBasis: 0, flexGrow: weight }} key={i}>
              <b className={`${compact ? "text-[12px]" : "text-[12px]"} truncate font-normal`}>{label}</b>
            </span>
          );
        })}
      </div>
      {!compact && <p className="mt-2 text-[9px] tracking-[.06em] text-[var(--muted)]">区块宽度表示{episodes.length > 1 ? "该结构中各行动的平均原文字数" : "各行动的原文字数"}</p>}
    </div>
  );
}

function LetterExcerpt({ episode }: { episode: RequestEpisode }) {
  const marks = episode.steps
    .map((step, i) => ({ act: step.act, i }))
    .filter((m): m is { act: ActMention; i: number } => Boolean(m.act))
    .filter((m, i, arr) => arr.findIndex((c) => c.act.id === m.act.id) === i)
    .sort((a, b) => a.act.start - b.act.start);
  const content: React.ReactNode[] = [];
  let cursor = 0;
  marks.forEach(({ act, i }) => {
    if (act.start < cursor) return;
    content.push(episode.letter.text.slice(cursor, act.start));
    const isReq = i === 2;
    content.push(
      <mark key={act.id} className={`px-0.5 text-[var(--ink)] ${isReq ? "border-b-2 border-[var(--purple)] bg-[var(--purple-pale)]" : "border-b border-[var(--line-dark)] bg-[rgba(79,71,126,.06)]"}`}>
        {episode.letter.text.slice(act.start, act.end)}
      </mark>,
    );
    cursor = act.end;
  });
  content.push(episode.letter.text.slice(cursor));
  return <p className="whitespace-pre-wrap text-[14px] leading-9 text-[var(--ink)]">{content}</p>;
}

// ── 模块C：统计依据 ──────────────────────────────────────────────

function StatisticsModule({ type, episodes }: { type: AcademicType; episodes: RequestEpisode[] }) {
  const features = PATH_META[type.code].featureOrder;
  return (
    <section className="pt-10" aria-labelledby="stats-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--ink)] pb-3" id="stats-title">
        <div className="flex items-baseline gap-4">
          <span className="text-[11px] tracking-[.14em] text-[var(--muted)]">统计依据</span>
          <h3 className="text-[21px] font-medium tracking-[.04em] text-[var(--ink)]">核心统计</h3>
        </div>
        <p className="text-[11px] text-[var(--muted)]">{type.letterCount}封书信 · {episodes.length}个请求实例</p>
      </div>

      {/* 关键数据 */}
      <div className="mt-6 grid gap-5 sm:grid-cols-3 border-b border-[var(--line)] pb-6">
        <div>
          <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">书信数量</p>
          <p className="mt-2 text-[23px] font-normal tabular-nums text-[var(--ink)]">{type.letterCount}<span className="mx-1 text-[12px] text-[var(--muted)]">/</span>178</p>
          <p className="mt-1 text-[11px] text-[var(--purple)]">{percent(type.corpusShare)}</p>
        </div>
        <div>
          <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">请求实例</p>
          <p className="mt-2 text-[23px] font-normal tabular-nums text-[var(--ink)]">{episodes.length}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">在178封中含{clustering.corpus.requestInstances}个</p>
        </div>
        <div>
          <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">分类稳定性</p>
          <p className="mt-2 text-[23px] font-normal tabular-nums text-[var(--ink)]">{percent(type.assignmentStability.eightyPercentSubsampling)}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">80%子样本保留率</p>
        </div>
      </div>

      {/* 特征对比 */}
      <div className="mt-6">
        <p className="text-[10px] tracking-[.1em] text-[var(--muted)] mb-4">与全部书信相比（圆点越靠右特征越突出）</p>
        <div className="space-y-4">
          {features.map((feature) => {
            const stats = type.features[feature];
            const left = zPos(stats.standardizedMeanCi95.lower);
            const right = zPos(stats.standardizedMeanCi95.upper);
            const point = zPos(stats.standardizedMean);
            return (
              <div key={feature}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12px]">{FEATURE_LABELS[feature]}</span>
                  <span className="font-sans text-[9px] text-[var(--muted)]">{formatFeatureValue(feature, stats.mean)}</span>
                </div>
                <div className="group relative mt-2 h-7">
                  {[-2, -1, 0, 1, 2].map((tick) => <i className={`absolute inset-y-0 w-px not-italic ${tick === 0 ? "bg-[var(--line-dark)]" : "bg-[var(--line)] opacity-60"}`} style={{ left: `${zPos(tick)}%` }} key={tick} />)}
                  <i className="absolute top-1/2 h-px -translate-y-1/2 bg-[var(--ink)] not-italic" style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%` }} />
                  <i className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--blue)] not-italic" style={{ left: `${point}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between border-t border-[var(--line)] pt-2 mt-4 font-sans text-[9px] text-[var(--muted)]"><span>低于平均</span><span>全部平均</span><span>高于平均</span></div>
      </div>

      <details className="mt-5 border-t border-dashed border-[var(--line)] pt-4 text-[11px] text-[var(--muted)]">
        <summary className="w-fit cursor-pointer border-b border-[var(--line-dark)] pb-1 text-[var(--ink)] hover:text-[var(--purple)]">查看类型稳定性</summary>
        <p className="mt-2 leading-5">改变指标权重时保留{percent(type.assignmentStability.featureWeightPerturbation)}；抽取80%书信重新分类时保留{percent(type.assignmentStability.eightyPercentSubsampling)}。</p>
      </details>
    </section>
  );
}

// ── 模块D+E：典型书信与原文证据 ──────────────────────────────────

function TypicalLettersModule({ typeCode, episodes }: { typeCode: PathCode; episodes: RequestEpisode[] }) {
  const [openEpisodeId, setOpenEpisodeId] = useState<string | null>(null);
  const curatedIds = CURATED_TYPE_LETTERS[typeCode];
  const letterMap = useMemo(() => new Map(dataset.letters.map((l) => [l.id, l])), []);

  const curatedEpisodes = useMemo(() => {
    return curatedIds.map((id) => {
      const letter = letterMap.get(id);
      if (!letter) return null;
      const ep = episodes.find((e) => e.letter.id === id);
      return ep ?? null;
    }).filter(Boolean) as RequestEpisode[];
  }, [curatedIds, letterMap, episodes]);

  return (
    <section className="pt-10" aria-labelledby="typical-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--ink)] pb-3" id="typical-title">
        <div className="flex items-baseline gap-4">
          <span className="text-[11px] tracking-[.14em] text-[var(--muted)]">典型书信</span>
          <h3 className="text-[21px] font-medium tracking-[.04em] text-[var(--ink)]">代表书信与原文证据</h3>
        </div>
        <p className="text-[11px] text-[var(--muted)]">{episodes.length}个请求实例</p>
      </div>

      <div className="mt-4 space-y-6">
        {curatedEpisodes.map((ep, gi) => {
          const isOpen = openEpisodeId === ep.id;
          return (
            <article className="border-b border-[var(--line)]" key={ep.id}>
              <button type="button" className="grid w-full grid-cols-[30px_minmax(0,1fr)_20px] gap-4 border-0 bg-transparent py-5 text-left hover:bg-[rgba(255,254,249,.55)] cursor-pointer" onClick={() => setOpenEpisodeId(isOpen ? null : ep.id)}>
                <span className="pt-1 text-[11px] tabular-nums text-[var(--muted)]">{String(gi + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-[var(--muted)]">
                    <span>第{ep.letter.number}通 · {ep.letter.year ?? "时间不详"} · 致{ep.recipient}</span>
                    <span className="text-[var(--purple)]">{isOpen ? "收起" : "展开原文"} </span>
                  </span>
                  <span className="mt-2 grid gap-4 lg:grid-cols-[minmax(250px,.8fr)_minmax(300px,1.2fr)] lg:items-center">
                    <StructureStrip episodes={[ep]} compact />
                    <span className="grid gap-2">
                      <span className="grid grid-cols-[58px_minmax(0,1fr)] gap-3">
                        <small className="pt-1 text-[10px] tracking-[.08em] text-[var(--purple)]">请求</small>
                        <span className="font-serif text-[12px] leading-6 text-[var(--ink)]">"{clip(ep.request.originalText)}"</span>
                      </span>
                      <span className="text-[10px] text-[var(--muted)]">来源：{ep.letter.source ?? "叶德辉书信集"} · 为什么归入此类：{PATH_META[typeCode].keyFinding}</span>
                    </span>
                  </span>
                </span>
                <span className={`pt-1 text-[13px] text-[var(--purple)] transition ${isOpen ? "rotate-45" : ""}`}>＋</span>
              </button>
              {isOpen && (
                <div className="mb-6 ml-[46px] bg-[rgba(255,254,249,.62)] px-5 py-4">
                  <p className="border-b border-[var(--line)] py-3 text-[10px] tracking-[.1em] text-[var(--muted)]">原文与行为标注</p>
                  <div className="pt-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div><p className="text-[11px] tracking-[.12em] text-[var(--muted)]">完整原信</p><h4 className="mt-1 text-[18px] font-normal text-[var(--ink)]">第{ep.letter.number}通 · {ep.letter.dateLabel ?? ep.letter.year ?? "时间不详"}</h4></div>
                    </div>
                    <div className="mx-auto max-w-[820px] py-6">
                      <LetterExcerpt episode={ep} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
                      <p className="text-[11px] text-[var(--muted)]">请求内容：{ep.request.subtype ?? "请求"} · {clip(ep.request.originalText, 120)}</p>
                      <Link className="text-[12px] text-[var(--purple)] hover:underline" href={sourceHref(ep)}>打开原信条目 →</Link>
                    </div>
                    {/* 白话解释 */}
                    <div className="mt-4 border-t border-dashed border-[var(--line)] pt-4">
                      <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">白话解释</p>
                      <p className="mt-1 text-[12px] leading-6 text-[var(--ink)]">
                        {ep.steps.filter(s => s.type !== "NONE" && s.act).map((s, i) => {
                          const label = s.type === "DIR" ? "提出请求" : ACTION_MEANINGS[s.type];
                          const text = clip(s.act?.originalText, 60);
                          return <span key={i}>{i > 0 ? "；然后" : ""}{label}（"{text}"）</span>;
                        })}
                        {ep.steps.filter(s => s.type !== "NONE" && s.act).length === 0 && "暂无标注行动可供解释"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {curatedEpisodes.length === 0 && (
        <p className="py-7 text-[12px] leading-7 text-[var(--muted)]">暂无已整理的典型书信，可查看下方完整请求实例列表。</p>
      )}

      {/* 更多请求实例 */}
      <details className="mt-5 border-t border-dashed border-[var(--line)] pt-4">
        <summary className="w-fit cursor-pointer text-[11px] text-[var(--muted)] hover:text-[var(--ink)]">查看全部 {episodes.length} 个请求实例</summary>
        <div className="mt-4 space-y-2">
          {episodes.slice(0, 20).map((ep, i) => (
            <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-3 border-b border-[var(--line)] py-2 text-[11px]" key={ep.id}>
              <span className="text-[var(--muted)]">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="text-[var(--ink)]">第{ep.letter.number}通 · {ep.letter.year ?? "时间不详"} · 致{ep.recipient}</span>
                <span className="ml-3 text-[var(--muted)]">"{clip(ep.request.originalText, 60)}"</span>
                <Link className="ml-3 text-[var(--purple)] hover:underline" href={sourceHref(ep)}>查看 →</Link>
              </span>
            </div>
          ))}
          {episodes.length > 20 && <p className="text-[10px] text-[var(--muted)] py-2">仅显示前20个实例</p>}
        </div>
      </details>
    </section>
  );
}

// ── 模块F：结构说明 ──────────────────────────────────────────────

function StructureExplanation({ typeCode }: { typeCode: PathCode }) {
  const explanations: Record<PathCode, { title: string; items: { label: string; text: string }[] }> = {
    A: {
      title: "先叙后请：信息铺垫与人情积累",
      items: [
        { label: "请求与人情", text: "叶德辉极少直接提出请求。在「先叙后请」型中，他会先告知近况、说明背景或展示材料，建立信息共享的基础之后再提出请托。这种结构反映了传统书信中「先通情、后言事」的礼仪习惯。" },
        { label: "请求与信息说明", text: "告知类行动在这类书信中占主导地位。请求不是凭空提出的，而是建立在充分的背景说明之上——让对方先理解来龙去脉，再自然引出需要对方做的事情。" },
        { label: "请求与书信礼仪", text: "请求平均出现在全信72.5%的位置，这意味着前面近四分之三的篇幅用于铺垫。这种做法既是礼仪的需要，也降低了被拒绝的风险。" },
      ],
    },
    B: {
      title: "论议收束：论证驱动型请求",
      items: [
        { label: "请求与论证", text: "在这类书信中，说服行动占比高达30.7%，明显超过其他类型。叶德辉会先陈述观点、评价方案或讨论分歧，在论证充分之后才将结论收束为一项明确的请求。" },
        { label: "请求与人情", text: "「论议收束」型书信往往涉及需要对方做出判断或决定的复杂事务。叶德辉通过论证来证明请求的合理性，以理性说服代替人情请托。" },
        { label: "请求与书信礼仪", text: "即使以论证为主，叶德辉仍然保持了书信的基本礼仪框架——通常以告知开场，以请求收尾，论证位于中间。" },
      ],
    },
    C: {
      title: "先请后叙：请求前置与后续补充",
      items: [
        { label: "请求与人情", text: "请求前置往往用于与关系较近的通信对象。叶德辉开门见山提出请求，表明双方关系足够密切，不需要过多铺垫。请求后的展开说明既是补充也是尊重。" },
        { label: "请求与信息说明", text: "请求后仍保留62.6%的篇幅用于继续说明和论议，说明叶德辉即使在直接提出请求后，仍然认为有必要提供足够的背景和支持信息。" },
        { label: "请求与书信礼仪", text: "请求前置不代表失礼。叶德辉通过在请求后展开详细说明，保持了书信的完整性和礼貌性。" },
      ],
    },
    D: {
      title: "连环请托：多项事务的集中处理",
      items: [
        { label: "多项请托之间的关系", text: "连环请托中的多项请求通常互相关联——可能是同一事务的不同方面，或是需要对方同时办理的几件事。请求之间的紧密排列反映了事务的紧迫性和关联性。" },
        { label: "请求与人情", text: "在一封信中连续提出多项请求，对通信关系提出了更高的要求。这类书信的通信对象往往是叶德辉最为倚重的几位，如孙毓修、易培基等。" },
        { label: "请求与信息说明", text: "即使请求高度集中，叶德辉仍然会在请求前后提供必要的说明。连环请求的结构通常是「事情背景→多项请求→回收确认」。" },
      ],
    },
  };

  const exp = explanations[typeCode];

  return (
    <section className="pt-10" aria-labelledby="explanation-title">
      <div className="border-b border-[var(--ink)] pb-3" id="explanation-title">
        <div className="flex items-baseline gap-4">
          <span className="text-[11px] tracking-[.14em] text-[var(--muted)]">结构说明</span>
          <h3 className="text-[21px] font-medium tracking-[.04em] text-[var(--ink)]">{exp.title}</h3>
        </div>
      </div>
      <div className="mt-6 space-y-6">
        {exp.items.map((item) => (
          <div key={item.label}>
            <h4 className="text-[14px] font-medium text-[var(--ink)]">{item.label}</h4>
            <p className="mt-2 text-[13px] leading-7 text-[var(--muted)]">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 主组件 ──────────────────────────────────────────────────────

export function RequestTypeDetailPage({ typeCode, from, question }: { typeCode: PathCode; from?: string; question?: string }) {
  const type = academic.featureStatistics.types.find((t) => t.code === typeCode)!;
  const [selectedEpId, setSelectedEpId] = useState<string | null>(null);

  const isFromResearch = from === "research";
  const backLabel = isFromResearch ? "← 返回问题研究" : "← 返回请求类型总览";
  const backHref = isFromResearch
    ? `/analysis?page=communication&question=${question ?? "request"}`
    : "/analysis/request";

  const episodes = useMemo(() => ALL_EPISODES.filter((ep) => {
    const row = clustering.assignments.find((a) => a.letterId === ep.letter.id);
    return row?.typeCode === typeCode;
  }), [typeCode]);

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[var(--paper)] pb-20 font-serif">
      <div className="site-container">
        {/* 返回路径 */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] py-4">
          <Link className="text-[11px] tracking-[.12em] text-[var(--muted)] hover:text-[var(--ink)]" href={backHref}>
            {backLabel}
          </Link>
          <nav className="flex items-end gap-5" aria-label="切换通信路径类型">
            {TYPE_ORDER.map((code) => (
              <Link
                className={`min-w-5 border-0 border-b bg-transparent px-0 pb-1.5 pt-1 text-[15px] leading-none transition-colors ${code === typeCode ? "border-current" : "border-transparent text-[var(--muted)] hover:border-[var(--line-dark)] hover:text-[var(--ink)]"}`}
                style={code === typeCode ? { color: TYPE_ACCENTS[code] } : undefined}
                href={`/analysis/request/${TYPE_SLUG_REVERSE[code]}`}
                aria-label={`切换至${code}类`}
                key={code}
              >
                {code}
              </Link>
            ))}
          </nav>
        </div>

        {/* 模块A：类型定义 + 模块B：表达路径 */}
        <header className="mt-5" style={{ color: TYPE_ACCENTS[typeCode] }}>
          <p className="text-[10px] tracking-[.14em]" style={{ color: TYPE_ACCENTS[type.code] }}>{type.code} · {PATH_META[type.code].short}</p>
          <h1 className="mt-2 text-[29px] font-normal tracking-[.05em] text-[var(--ink)]">{type.name}</h1>
          <p className="mt-3 max-w-[720px] text-[13px] leading-7 text-[var(--muted)]">{PATH_META[type.code].description}</p>

          {/* 模块B：表达路径 */}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-y border-[var(--line)] py-4">
            <span className="text-[11px] tracking-[.1em] text-[var(--muted)]">表达路径：</span>
            <PathMotif typeCode={typeCode} />
            <span className="text-[10px] text-[var(--muted)] ml-auto">{type.letterCount}封 · 占全部含请求书信的{percent(type.corpusShare)}</span>
          </div>
        </header>

        {/* 关键数字概要 */}
        <div className="mt-7 grid gap-5 sm:grid-cols-4 border-b border-[var(--line)] pb-6">
          <div>
            <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">书信数量</p>
            <p className="mt-2 text-[23px] font-normal tabular-nums text-[var(--ink)]">{type.letterCount}<span className="mx-1 text-[12px] text-[var(--muted)]">封</span></p>
          </div>
          <div>
            <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">请求实例</p>
            <p className="mt-2 text-[23px] font-normal tabular-nums text-[var(--ink)]">{episodes.length}<span className="mx-1 text-[12px] text-[var(--muted)]">个</span></p>
          </div>
          <div>
            <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">占全部含请求书信</p>
            <p className="mt-2 text-[23px] font-normal tabular-nums text-[var(--ink)]">{percent(type.corpusShare)}</p>
          </div>
          <div>
            <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">关键发现</p>
            <p className="mt-2 text-[14px] leading-6 text-[var(--ink)]">{PATH_META[typeCode].keyValue}</p>
          </div>
        </div>

        {/* 模块C：统计依据 */}
        <StatisticsModule type={type} episodes={episodes} />

        {/* 模块D+E：典型书信与原文证据 */}
        <TypicalLettersModule typeCode={typeCode} episodes={episodes} />

        {/* 模块F：结构说明 */}
        <StructureExplanation typeCode={typeCode} />

        {/* 底部返回 */}
        <div className="mt-14 border-t border-[var(--line-dark)] pt-6 text-center">
          <Link className="text-[12px] text-[var(--muted)] hover:text-[var(--purple)]" href={backHref}>
            {backLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
