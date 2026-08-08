"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dataset } from "@/lib/data-adapter";
import type { ActMention, ActType, Letter } from "@/lib/types";
import clusterSource from "@/analysis-output/preliminary-request-path-clusters.json";
import academicSource from "@/analysis-output/academic-figure-statistics.json";
import { ResearchCarousel } from "./ResearchCarousel";

type PathCode = "A" | "B" | "C" | "D";
type StepType = ActType | "NONE";
type Position = 0 | 1 | 3 | 4;

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
  gloss: string;
  letterCount: number;
  requestCount: number;
}

interface RequestEpisode {
  id: string;
  letter: Letter;
  request: ActMention;
  steps: [StepType, StepType, "DIR", StepType, StepType];
  acts: [ActMention | null, ActMention | null, ActMention, ActMention | null, ActMention | null];
}

const clustering = clusterSource as unknown as {
  corpus: { allLetters: number; requestBearingLetters: number; requestInstances: number };
  types: ClusterType[];
  assignments: ClusterAssignment[];
};

const academic = academicSource as unknown as {
  featureStatistics: { types: Array<{ code: PathCode; corpusShare: number }> };
};

const ACTION_LABELS: Record<StepType, string> = {
  AST: "陈述",
  DIR: "请求",
  EXP: "表达",
  COM: "承诺",
  NONE: "无行动",
};

const ACTION_MEANINGS: Record<StepType, string> = {
  AST: "交代事实、进展或通信背景",
  DIR: "连续提出另一项需要办理的事项",
  EXP: "补充问候、关切或关系维系",
  COM: "协商条件、时机与处理方式",
  NONE: "该位置没有其他已标注行动",
};

const PATH_META: Record<PathCode, { short: string; description: string; finding: string; motif: string[] }> = {
  A: {
    short: "请求后置",
    description: "先交代人物、事情或书籍背景，再提出需要对方完成的行动。",
    finding: "首次请求平均位于全信72.5%处",
    motif: ["告知", "说明", "请求"],
  },
  B: {
    short: "论议收束",
    description: "经过评价、论议或方案取舍，最后把讨论收束为请求。",
    finding: "说服行动平均占30.7%",
    motif: ["告知", "论议", "请求"],
  },
  C: {
    short: "请求前置",
    description: "请求较早出现，后文继续补充事实、理由或判断。",
    finding: "请求后仍保留62.6%的篇幅",
    motif: ["请求", "继续说明", "论议"],
  },
  D: {
    short: "请求成组",
    description: "多项请求或问询在信中连续出现，形成一组需要办理的事项。",
    finding: "连续请求程度达到87.7%",
    motif: ["事情", "请求·请求", "回收"],
  },
};

const TYPE_COLORS: Record<PathCode, string> = {
  A: "#526b80",
  B: "#9a7c45",
  C: "#58766b",
  D: "#955c56",
};

const CURATED_EVIDENCE: Record<PathCode, string[]> = {
  A: ["153_1911_缪荃孙", "187_1919_夏敬观", "257_0_杨树达"],
  B: ["197_1919_夏敬观", "099_1917_松崎鹤雄", "196_1919_夏敬观"],
  C: ["162_1913_缪荃孙", "049_1913_松崎鹤雄", "300_1908_孙毓修"],
  D: ["247_1920_孙毓修", "120_1920_松崎鹤雄", "006_1925_易培基"],
};

const VIEW_LABELS = ["请求类型总览", "通信行动结构", "请求前后分布", "典型书信证据"] as const;
const TYPE_ORDER: PathCode[] = ["A", "B", "C", "D"];
const POSITIONS: Position[] = [0, 1, 3, 4];
const POSITION_LABELS: Record<Position, string> = { 0: "前二步", 1: "前一步", 3: "后一步", 4: "后二步" };
const MATRIX_ACTIONS: StepType[] = ["AST", "DIR", "EXP", "COM", "NONE"];
const letterMap = new Map(dataset.letters.map((letter) => [letter.id, letter]));
const assignmentMap = new Map(clustering.assignments.map((assignment) => [assignment.letterId, assignment]));

function cleanText(text: string | null | undefined, max = 74) {
  const value = (text ?? "").replace(/\s+/g, "");
  if (!value) return "原文暂缺";
  return value.length > max ? `${value.slice(0, max)}……` : value;
}

function firstRequest(letterId: string) {
  return [...(dataset.actsByLetter[letterId] ?? [])]
    .filter((act) => act.type === "DIR")
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

function readablePath(path: string) {
  return path.split("→").map((code) => ACTION_LABELS[code as StepType] ?? code).join(" → ");
}

function makeEpisodes(): RequestEpisode[] {
  return Object.entries(dataset.actsByLetter).flatMap(([letterId, rawActs]) => {
    const letter = letterMap.get(letterId);
    if (!letter) return [];
    const acts = [...rawActs].sort((a, b) => a.start - b.start);
    return acts.flatMap((act, index) => {
      if (act.type !== "DIR") return [];
      const beforeTwo = acts[index - 2] ?? null;
      const beforeOne = acts[index - 1] ?? null;
      const afterOne = acts[index + 1] ?? null;
      const afterTwo = acts[index + 2] ?? null;
      return [{
        id: act.id,
        letter,
        request: act,
        steps: [beforeTwo?.type ?? "NONE", beforeOne?.type ?? "NONE", "DIR", afterOne?.type ?? "NONE", afterTwo?.type ?? "NONE"],
        acts: [beforeTwo, beforeOne, act, afterOne, afterTwo],
      } as RequestEpisode];
    });
  });
}

const EPISODES = makeEpisodes();

function groupPaths(episodes: RequestEpisode[]) {
  const groups = new Map<string, RequestEpisode[]>();
  episodes.forEach((episode) => {
    const key = episode.steps.join("→");
    groups.set(key, [...(groups.get(key) ?? []), episode]);
  });
  return [...groups.entries()]
    .map(([path, items]) => ({ path, items }))
    .sort((a, b) => b.items.length - a.items.length);
}

const TOP_PATH = groupPaths(EPISODES)[0];

function compactActs(letterId: string) {
  const acts = [...(dataset.actsByLetter[letterId] ?? [])]
    .filter((act) => act.type !== "EXP")
    .sort((a, b) => a.start - b.start);
  return acts.filter((act, index) => index === 0 || act.type !== acts[index - 1].type).slice(0, 6);
}

function requestType(code: PathCode) {
  return clustering.types.find((type) => type.code === code)!;
}

function RequestSummary() {
  const typeA = requestType("A");
  const typeB = requestType("B");
  return (
    <section className="grid gap-6 border-b border-[var(--line)] py-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(420px,.8fr)] lg:items-center">
      <div>
        <p className="text-[10px] font-semibold tracking-[.18em] text-[var(--purple)]">研究发现</p>
        <p className="mt-2 max-w-[780px] text-[16px] leading-8 text-[var(--ink)] sm:text-[18px] sm:leading-8">
          叶德辉很少直接提出请求。他通常先通过<strong className="font-semibold text-[var(--purple-deep)]">告知、赞扬、论议或说明背景</strong>建立通信语境，再进入核心请求，并在请求之后继续补充说明、交代后续或维系关系。请求是完整通信行动链中的一个环节。
        </p>
      </div>
      <dl className="grid grid-cols-2 border-y border-[var(--line)]">
        {[
          [String(typeA.letterCount), "先叙后请型·封"],
          [String(typeB.letterCount), "论议收束型·封"],
          [String(clustering.corpus.requestBearingLetters), "涉及请求的书信"],
          [readablePath(TOP_PATH.path), "最高频行动链"],
        ].map(([value, label], index) => (
          <div className={`min-h-[68px] px-3 py-3 ${index % 2 === 1 ? "border-l border-[var(--line)]" : ""} ${index > 1 ? "border-t border-[var(--line)]" : ""}`} key={label}>
            <dt className="text-[9px] tracking-[.06em] text-[var(--muted)]">{label}</dt>
            <dd className={`${index === 3 ? "mt-1.5 text-[11px] leading-5" : "mt-1 text-[22px]"} text-[var(--ink)]`}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RequestTypeOverview() {
  const [activeType, setActiveType] = useState<PathCode>("A");
  const [hoveredType, setHoveredType] = useState<PathCode | null>(null);
  const currentCode = hoveredType ?? activeType;
  const current = requestType(currentCode);
  const share = academic.featureStatistics.types.find((type) => type.code === currentCode)?.corpusShare ?? current.letterCount / clustering.corpus.requestBearingLetters;

  return (
    <div className="grid min-h-[500px] items-stretch gap-7 py-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,.72fr)]">
      <div className="relative flex min-h-[430px] items-center justify-center border-y border-[var(--line)] bg-[rgba(255,254,249,.34)] px-3 py-6">
        <div className="grid w-full max-w-[760px] grid-cols-2 gap-2 sm:gap-3">
          {TYPE_ORDER.map((code, index) => {
            const type = requestType(code);
            const selected = code === activeType;
            return (
              <button
                type="button"
                className={`group min-h-[178px] border px-5 py-5 text-left transition sm:px-7 ${selected ? "border-[var(--line-dark)] bg-[var(--surface)]" : "border-transparent bg-[rgba(81,78,70,.035)] hover:border-[var(--line)] hover:bg-[var(--surface)]"} ${index === 0 ? "rounded-br-[70px]" : index === 1 ? "rounded-bl-[70px]" : index === 2 ? "rounded-tr-[70px]" : "rounded-tl-[70px]"}`}
                onClick={() => setActiveType(code)}
                onMouseEnter={() => setHoveredType(code)}
                onMouseLeave={() => setHoveredType(null)}
                onFocus={() => setHoveredType(code)}
                onBlur={() => setHoveredType(null)}
                aria-pressed={selected}
                key={code}
              >
                <span className="flex items-center justify-between text-[10px] tracking-[.1em]" style={{ color: TYPE_COLORS[code] }}><b className="font-normal">{code} · {PATH_META[code].short}</b><span>{type.letterCount}封</span></span>
                <strong className="mt-2 block text-[18px] font-normal tracking-[.04em] text-[var(--ink)] sm:text-[21px]">{type.name}</strong>
                <span className="mt-3 flex items-center gap-2 text-[11px] text-[var(--muted)]">
                  {PATH_META[code].motif.map((item, motifIndex) => <span className="contents" key={item}>{motifIndex > 0 && <i className="not-italic text-[var(--line-dark)]">→</i>}<span className={item.includes("请求") ? "text-[var(--purple)]" : ""}>{item}</span></span>)}
                </span>
                <span className="mt-3 block text-[10px] leading-5 text-[var(--muted)]">{PATH_META[code].finding}</span>
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 grid size-[104px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[var(--line-dark)] bg-[var(--paper)] text-center shadow-[0_5px_18px_rgba(39,36,42,.05)]">
          <span><b className="block text-[20px] font-normal text-[var(--purple)]">请求</b><small className="mt-1 block text-[9px] text-[var(--muted)]">四种路径</small></span>
        </div>
      </div>

      <aside className="flex min-h-[430px] flex-col justify-between border-y border-[var(--line-dark)] py-6" aria-live="polite">
        <div>
          <p className="text-[10px] tracking-[.16em]" style={{ color: TYPE_COLORS[currentCode] }}>{currentCode} · 当前类型</p>
          <h3 className="mt-3 text-[27px] font-normal tracking-[.04em]">{current.name}</h3>
          <p className="mt-4 text-[14px] leading-7 text-[var(--muted)]">{PATH_META[currentCode].description}</p>
          <dl className="mt-6 grid grid-cols-2 border-y border-[var(--line)]">
            <div className="py-4"><dt className="text-[9px] text-[var(--muted)]">书信数量</dt><dd className="mt-1 text-[24px]">{current.letterCount}<small className="ml-1 text-[10px] text-[var(--muted)]">封</small></dd></div>
            <div className="border-l border-[var(--line)] py-4 pl-5"><dt className="text-[9px] text-[var(--muted)]">所占比例</dt><dd className="mt-1 text-[24px]">{(share * 100).toFixed(1)}<small className="ml-1 text-[10px] text-[var(--muted)]">%</small></dd></div>
          </dl>
          <p className="mt-5 text-[12px] leading-6"><span className="text-[var(--purple)]">关键观察：</span>{PATH_META[currentCode].finding}</p>
        </div>
        <p className="border-t border-[var(--line)] pt-4 text-[10px] leading-5 text-[var(--muted)]">悬停比较类型；点击后锁定右侧解释。分类来自178封含请求书信的行动顺序、请求位置与行动占比。</p>
      </aside>
    </div>
  );
}

function CommunicationStructure() {
  const [selected, setSelected] = useState<{ position: Position; type: StepType }>({ position: 1, type: "AST" });
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    POSITIONS.forEach((position) => MATRIX_ACTIONS.forEach((type) => {
      map.set(`${position}-${type}`, EPISODES.filter((episode) => episode.steps[position] === type).length);
    }));
    return map;
  }, []);
  const maxCount = Math.max(...counts.values());
  const matched = EPISODES.filter((episode) => episode.steps[selected.position] === selected.type);
  const path = groupPaths(matched)[0] ?? TOP_PATH;
  const representative = path.items[0];
  const uniqueLetters = new Set(matched.map((episode) => episode.letter.id)).size;

  return (
    <div className="grid min-h-[500px] items-stretch gap-7 py-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,.68fr)]">
      <div className="border-y border-[var(--line)] py-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--muted)]"><span className="text-[var(--ink)]">前置行为</span><span className="mx-3 text-[var(--line-dark)]">→</span><span className="text-[var(--purple)]">核心请求</span><span className="mx-3 text-[var(--line-dark)]">→</span><span className="text-[var(--ink)]">后置行为</span></p>
          <span className="text-[10px] text-[var(--muted)]">圆点越大，出现越频繁 · 点击查看证据</span>
        </div>
        <div className="grid grid-cols-[74px_repeat(4,minmax(0,1fr))] items-center border-t border-[var(--line)]">
          <span className="h-10 border-b border-[var(--line)]" />
          {POSITIONS.map((position) => <span className="grid h-10 place-items-center border-b border-l border-[var(--line)] text-[10px] text-[var(--muted)]" key={position}>{POSITION_LABELS[position]}</span>)}
          {MATRIX_ACTIONS.map((type) => (
            <div className="contents" key={type}>
              <span className="grid h-[47px] place-items-center border-b border-[var(--line)] text-[11px] text-[var(--ink)]">{ACTION_LABELS[type]}</span>
              {POSITIONS.map((position) => {
                const count = counts.get(`${position}-${type}`) ?? 0;
                const active = selected.position === position && selected.type === type;
                const size = count ? 8 + Math.sqrt(count / maxCount) * 30 : 0;
                return (
                  <button
                    type="button"
                    className={`group relative grid h-[47px] place-items-center border-b border-l border-[var(--line)] bg-transparent ${active ? "bg-[rgba(82,107,128,.06)]" : ""}`}
                    onClick={() => count && setSelected({ position, type })}
                    disabled={!count}
                    aria-label={`${POSITION_LABELS[position]}出现${ACTION_LABELS[type]}${count}次`}
                    key={position}
                  >
                    {count ? <i className="block rounded-full border border-white bg-[var(--blue)] not-italic transition-transform group-hover:scale-110" style={{ width: size, height: size, opacity: active ? 1 : .28 + count / maxCount * .68, boxShadow: active ? "0 0 0 3px rgba(82,107,128,.13)" : undefined }} /> : null}
                    {count ? <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap bg-[var(--ink)] px-2 py-1 text-[9px] text-white group-hover:block">{count}次 · {Math.round(count / EPISODES.length * 100)}%</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <aside className="flex min-h-[430px] flex-col border-y border-[var(--line-dark)] py-5" aria-live="polite">
        <p className="text-[10px] tracking-[.14em] text-[var(--blue)]">当前行动结构</p>
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] leading-6">
          {path.path.split("→").map((code, index) => <span className="contents" key={`${code}-${index}`}>{index > 0 && <i className="not-italic text-[var(--line-dark)]">→</i>}<span className={code === "DIR" ? "text-[var(--purple)]" : code === "NONE" ? "text-[var(--muted)]" : "text-[var(--ink)]"}>{ACTION_LABELS[code as StepType]}</span></span>)}
        </div>
        <dl className="mt-5 grid grid-cols-2 border-y border-[var(--line)] py-4">
          <div><dt className="text-[9px] text-[var(--muted)]">当前位置出现</dt><dd className="mt-1 text-[23px]">{matched.length}<small className="ml-1 text-[10px] text-[var(--muted)]">次</small></dd></div>
          <div className="border-l border-[var(--line)] pl-4"><dt className="text-[9px] text-[var(--muted)]">涉及书信</dt><dd className="mt-1 text-[23px]">{uniqueLetters}<small className="ml-1 text-[10px] text-[var(--muted)]">封</small></dd></div>
        </dl>
        <p className="mt-5 text-[13px] leading-7 text-[var(--muted)]"><span className="text-[var(--ink)]">{POSITION_LABELS[selected.position]}的{ACTION_LABELS[selected.type]}</span>表示{ACTION_MEANINGS[selected.type]}。在这一局部结构中，右侧所示行动链出现最多。</p>
        <div className="mt-auto border-t border-[var(--line)] pt-4">
          <p className="text-[9px] tracking-[.12em] text-[var(--muted)]">代表性书信</p>
          <p className="mt-2 text-[12px]">第{representative.letter.number}通 · {representative.letter.year ?? "年代未详"} · 致{representative.letter.recipient}</p>
          <Link className="mt-2 line-clamp-2 block text-[13px] leading-6 text-[var(--blue)] hover:underline" href={sourceHref(representative.letter, representative.request)}>“{cleanText(representative.request.originalText, 54)}” ↗</Link>
        </div>
      </aside>
    </div>
  );
}

function BeforeAfterDistribution() {
  const [selected, setSelected] = useState<{ stage: "before" | "after"; type: StepType }>({ stage: "before", type: "AST" });
  const distributions = useMemo(() => {
    const summarize = (positions: number[]) => MATRIX_ACTIONS.filter((type) => type !== "NONE").map((type) => ({
      type,
      count: EPISODES.reduce((sum, episode) => sum + positions.filter((position) => episode.steps[position] === type).length, 0),
    })).sort((a, b) => b.count - a.count);
    return { before: summarize([0, 1]), after: summarize([3, 4]) };
  }, []);
  const selectedPositionIndexes = selected.stage === "before" ? [0, 1] : [3, 4];
  const evidence = EPISODES.find((episode) => selectedPositionIndexes.some((position) => episode.steps[position] === selected.type)) ?? EPISODES[0];
  const max = Math.max(...distributions.before.map((item) => item.count), ...distributions.after.map((item) => item.count));

  const Bars = ({ stage, items }: { stage: "before" | "after"; items: Array<{ type: StepType; count: number }> }) => (
    <div className="space-y-2.5">
      {items.slice(0, 6).map((item) => {
        const active = selected.stage === stage && selected.type === item.type;
        return (
          <button type="button" className="grid w-full grid-cols-[54px_minmax(0,1fr)_38px] items-center gap-2 border-0 bg-transparent text-left" onClick={() => setSelected({ stage, type: item.type })} key={item.type}>
            <span className={`text-[11px] ${active ? "text-[var(--purple)]" : "text-[var(--muted)]"}`}>{ACTION_LABELS[item.type]}</span>
            <span className="h-7 bg-[rgba(81,78,70,.045)]"><i className="block h-full not-italic transition-all" style={{ width: `${item.count / max * 100}%`, background: active ? "var(--purple)" : stage === "before" ? "#7e8f9c" : "#9b8874", opacity: active ? .9 : .62 }} /></span>
            <span className="text-right text-[10px] tabular-nums text-[var(--muted)]">{item.count}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-[500px] py-4">
      <div className="grid items-stretch gap-5 border-y border-[var(--line)] py-6 lg:grid-cols-[minmax(0,1fr)_148px_minmax(0,1fr)]">
        <section>
          <p className="mb-4 text-[10px] tracking-[.13em] text-[var(--blue)]">请求之前 · 背景建立与信息说明</p>
          <Bars stage="before" items={distributions.before} />
        </section>
        <div className="flex min-h-[280px] flex-col items-center justify-center border-y border-[var(--line-dark)] bg-[rgba(255,254,249,.48)] text-center lg:border-x lg:border-y-0">
          <span className="text-[9px] tracking-[.14em] text-[var(--muted)]">核心行动</span>
          <strong className="my-4 text-[25px] font-normal text-[var(--purple)]">请求</strong>
          <span className="text-[20px] tabular-nums">{EPISODES.length}</span>
          <small className="mt-1 text-[9px] text-[var(--muted)]">个请求实例</small>
        </div>
        <section>
          <p className="mb-4 text-[10px] tracking-[.13em] text-[var(--gold)]">请求之后 · 补充说明与关系维系</p>
          <Bars stage="after" items={distributions.after} />
        </section>
      </div>
      <aside className="mt-5 grid gap-5 border-y border-[var(--line-dark)] bg-[rgba(255,254,249,.34)] px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.72fr)] lg:items-center" aria-live="polite">
        <p className="text-[13px] leading-7 text-[var(--muted)]"><span className="text-[var(--ink)]">{selected.stage === "before" ? "请求前" : "请求后"}的{ACTION_LABELS[selected.type]}</span>主要用于{ACTION_MEANINGS[selected.type]}。整体上，请求前后的行动并未中断通信，而是把请求嵌入更长的叙述与关系维护之中。</p>
        <div className="border-l border-[var(--line)] pl-5">
          <p className="text-[9px] text-[var(--muted)]">对应书信例证 · 第{evidence.letter.number}通 · 致{evidence.letter.recipient}</p>
          <Link className="mt-1.5 line-clamp-2 block text-[12px] leading-6 text-[var(--blue)] hover:underline" href={sourceHref(evidence.letter, evidence.request)}>“{cleanText(evidence.request.originalText, 48)}” ↗</Link>
        </div>
      </aside>
    </div>
  );
}

function EvidenceCard({ id, code }: { id: string; code: PathCode }) {
  const letter = letterMap.get(id);
  const assignment = assignmentMap.get(id);
  if (!letter) return null;
  const request = firstRequest(id);
  const acts = compactActs(id);
  return (
    <article className="flex min-h-[350px] flex-col border-y border-[var(--line-dark)] bg-[rgba(255,254,249,.42)] px-5 py-5">
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] pb-3">
        <span className="text-[10px] tracking-[.1em]" style={{ color: TYPE_COLORS[code] }}>{code} · {PATH_META[code].short}</span>
        <span className="text-[9px] text-[var(--muted)]">第{letter.number}通</span>
      </header>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[10px]">
        <div><dt className="text-[var(--muted)]">日期</dt><dd className="mt-1 text-[12px]">{letter.dateLabel ?? (letter.year ? `${letter.year}年` : "年代未详")}</dd></div>
        <div><dt className="text-[var(--muted)]">收信人</dt><dd className="mt-1 text-[12px]">{letter.recipient}</dd></div>
        <div><dt className="text-[var(--muted)]">请求类型</dt><dd className="mt-1 text-[12px]">{assignment?.typeName ?? requestType(code).name}</dd></div>
        <div><dt className="text-[var(--muted)]">行动结构</dt><dd className="mt-1 line-clamp-2 text-[11px] leading-5">{assignment ? readablePath(assignment.collapsedPath) : acts.map((act) => ACTION_LABELS[act.type]).join(" → ")}</dd></div>
      </dl>
      <blockquote className="my-5 line-clamp-4 border-l-2 border-[var(--line-dark)] pl-4 text-[14px] leading-7 text-[var(--ink)]">“{cleanText(request?.originalText, 78)}”</blockquote>
      <Link className="mt-auto w-fit border-b border-[var(--blue)] pb-1 text-[11px] text-[var(--blue)]" href={sourceHref(letter, request)}>查看书信详情 ↗</Link>
    </article>
  );
}

function TypicalEvidence({ onOpenAll }: { onOpenAll: () => void }) {
  const featured: Array<[string, PathCode]> = [
    [CURATED_EVIDENCE.A[0], "A"],
    [CURATED_EVIDENCE.B[0], "B"],
    [CURATED_EVIDENCE.D[0], "D"],
  ];
  return (
    <div className="min-h-[500px] py-4">
      <div className="grid gap-4 md:grid-cols-3">
        {featured.map(([id, code]) => <EvidenceCard id={id} code={code} key={id} />)}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4">
        <p className="text-[11px] leading-6 text-[var(--muted)]">主页面仅保留三封具有不同请求路径的代表书信；完整证据集包含{clustering.corpus.requestBearingLetters}封含请求书信。</p>
        <button type="button" className="shrink-0 border border-[var(--line-dark)] bg-transparent px-4 py-2 text-[11px] text-[var(--ink)] transition hover:border-[var(--purple)] hover:text-[var(--purple)]" onClick={onOpenAll}>查看全部证据</button>
      </div>
    </div>
  );
}

export function RequestResearch({
  activeView,
  onViewChange,
  onOpenEvidence,
}: {
  activeView: number;
  onViewChange: (index: number) => void;
  onOpenEvidence: () => void;
}) {
  return (
    <div className="min-w-0">
      <RequestSummary />
      <ResearchCarousel labels={VIEW_LABELS} activeIndex={activeView} onChange={onViewChange} ariaLabel="请求问题分析">
        {activeView === 0 && <RequestTypeOverview />}
        {activeView === 1 && <CommunicationStructure />}
        {activeView === 2 && <BeforeAfterDistribution />}
        {activeView === 3 && <TypicalEvidence onOpenAll={onOpenEvidence} />}
      </ResearchCarousel>
    </div>
  );
}

function topStructures() {
  const counts = new Map<string, number>();
  clustering.assignments.forEach((assignment) => counts.set(assignment.collapsedPath, (counts.get(assignment.collapsedPath) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
}

export function RequestEvidenceDrawer({ onClose }: { onClose: () => void }) {
  const [typeFilter, setTypeFilter] = useState<"ALL" | PathCode>("ALL");
  const [structureFilter, setStructureFilter] = useState("ALL");
  const structures = useMemo(topStructures, []);
  const rows = clustering.assignments.filter((assignment) =>
    (typeFilter === "ALL" || assignment.typeCode === typeFilter)
    && (structureFilter === "ALL" || assignment.collapsedPath === structureFilter),
  );

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-[var(--line-dark)] bg-[var(--paper)] px-6 py-5 sm:px-8">
        <div className="flex items-start justify-between gap-5">
          <div><p className="text-[9px] tracking-[.16em] text-[var(--purple)]">书信证据库</p><h2 className="mt-2 text-[23px] font-normal">全部请求证据</h2><p className="mt-1 text-[10px] text-[var(--muted)]">{rows.length} / {clustering.corpus.requestBearingLetters} 封</p></div>
          <button type="button" className="grid size-9 place-items-center border border-[var(--line)] text-[18px]" onClick={onClose} aria-label="关闭证据面板">×</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-[10px] text-[var(--muted)]">请求类型
            <select className="mt-1 block h-10 w-full border border-[var(--line-dark)] bg-[var(--surface)] px-3 text-[12px] text-[var(--ink)]" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "ALL" | PathCode)}>
              <option value="ALL">全部类型</option>
              {TYPE_ORDER.map((code) => <option value={code} key={code}>{code} · {requestType(code).name}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-[var(--muted)]">行动结构
            <select className="mt-1 block h-10 w-full border border-[var(--line-dark)] bg-[var(--surface)] px-3 text-[12px] text-[var(--ink)]" value={structureFilter} onChange={(event) => setStructureFilter(event.target.value)}>
              <option value="ALL">全部结构</option>
              {structures.map(([path, count]) => <option value={path} key={path}>{readablePath(path)}（{count}封）</option>)}
            </select>
          </label>
        </div>
      </header>
      <div className="px-6 pb-10 sm:px-8">
        {rows.map((assignment) => {
          const letter = letterMap.get(assignment.letterId);
          if (!letter) return null;
          const request = firstRequest(letter.id);
          return (
            <article className="grid gap-3 border-b border-[var(--line)] py-5 sm:grid-cols-[70px_minmax(0,1fr)_auto] sm:items-start" key={assignment.letterId}>
              <span className="text-[10px] tracking-[.1em]" style={{ color: TYPE_COLORS[assignment.typeCode] }}>{assignment.typeCode} · 第{letter.number}通</span>
              <div><p className="text-[13px]">{letter.year ?? "年代未详"} · 致{letter.recipient}</p><p className="mt-1 text-[10px] leading-5 text-[var(--muted)]">{assignment.typeName} · {readablePath(assignment.collapsedPath)}</p><blockquote className="mt-2 line-clamp-2 text-[12px] leading-6 text-[var(--ink)]">“{cleanText(request?.originalText, 68)}”</blockquote></div>
              <Link className="w-fit border-b border-[var(--blue)] pb-1 text-[10px] text-[var(--blue)]" href={sourceHref(letter, request)}>查看详情 ↗</Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
