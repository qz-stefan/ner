"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dataset } from "@/lib/data-adapter";
import type { ActMention, ActType, EventType, Letter } from "@/lib/types";

// ── 类型 ────────────────────────────────────────────────────────

type StepType = ActType | "NONE";
type Position = 0 | 1 | 3 | 4;

interface EpisodeStep {
  type: StepType;
  act: ActMention | null;
}

interface RequestEpisode {
  id: string;
  letter: Letter;
  request: ActMention;
  recipient: string;
  domain: EventType | "UNK";
  steps: [EpisodeStep, EpisodeStep, EpisodeStep, EpisodeStep, EpisodeStep];
  pathKey: string;
}

interface SelectedCell {
  position: Position;
  type: StepType;
}

interface PathGroup {
  key: string;
  episodes: RequestEpisode[];
}

// ── 常量 ────────────────────────────────────────────────────────

const ACTION_LABELS: Record<StepType, string> = {
  AST: "陈述", DIR: "指示", EXP: "表达", COM: "承诺", NONE: "无行动",
};

const ACTION_MEANINGS: Record<StepType, string> = {
  AST: "陈述事实、进展或背景",
  DIR: "提出建议、请求或指示",
  EXP: "表达赞扬、关切或维系关系",
  COM: "承诺采取行动或提供帮助",
  NONE: "没有出现其他已标注行动",
};

const PREFERRED_RECIPIENTS = [
  "松崎鹤雄", "缪荃孙", "孙毓修", "易培基", "夏敬观", "吴庆坻", "杨树达", "刘承干",
] as const;

const POSITIONS: Position[] = [0, 1, 3, 4];
const POSITION_META: Record<Position, { label: string; phrase: string; code: string }> = {
  0: { label: "前两步", phrase: "请求前第2个行动", code: "−2" },
  1: { label: "前一步", phrase: "紧邻请求之前", code: "−1" },
  3: { label: "后一步", phrase: "紧随请求之后", code: "+1" },
  4: { label: "后两步", phrase: "请求后第2个行动", code: "+2" },
};

const STEP_ORDER: StepType[] = ["AST", "EXP", "AST", "DIR", "EXP", "COM", "DIR", "NONE"];
const STEP_LABELS: Record<StepType, string> = {
  AST: "陈述", DIR: "指示", EXP: "表达", COM: "承诺", NONE: "无行动",
};

const DOMAINS: Array<{ value: EventType | "ALL"; label: string }> = [
  { value: "ALL", label: "全部事务" },
  { value: "BIB", label: "文献活动" },
  { value: "SOC", label: "社会交往" },
  { value: "ACA", label: "学术活动" },
  { value: "POL", label: "政治时局" },
  { value: "FAM", label: "家族事务" },
];

// ── 工具函数 ────────────────────────────────────────────────────

function pct(count: number, total: number) {
  return total ? `${Math.round((count / total) * 100)}%` : "—";
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
      const step = (offset: number): EpisodeStep => {
        const act = acts[index + offset] ?? null;
        return { type: (act?.type ?? "NONE") as StepType, act };
      };
      const steps: RequestEpisode["steps"] = [
        step(-2), step(-1),
        { type: "DIR", act: request },
        step(1), step(2),
      ];
      return [{
        id: request.id, letter, request, recipient: letter.recipient,
        domain: linkedDomain(letterId, request), steps,
        pathKey: steps.map((s) => s.type).join(">"),
      }];
    });
  });
}

const ALL_EPISODES = makeEpisodes();

function countCell(episodes: RequestEpisode[], cell: SelectedCell) {
  return episodes.filter((ep) => ep.steps[cell.position].type === cell.type).length;
}

function groupByPath(episodes: RequestEpisode[]): PathGroup[] {
  const groups = new Map<string, RequestEpisode[]>();
  for (const ep of episodes) {
    const cur = groups.get(ep.pathKey) ?? [];
    cur.push(ep);
    groups.set(ep.pathKey, cur);
  }
  return [...groups.entries()]
    .map(([key, items]) => ({ key, episodes: items }))
    .sort((a, b) => b.episodes.length - a.episodes.length);
}

function sourceHref(episode: RequestEpisode) {
  const params = new URLSearchParams({
    q: episode.request.originalText, scope: "fulltext",
    at: String(episode.request.start), act: episode.request.id,
  });
  return `/letter/${encodeURIComponent(episode.letter.id)}?${params.toString()}`;
}

function clippedActionText(text: string | undefined, fallback: string, maxLength = 72) {
  if (!text) return fallback;
  const clean = text.replace(/\s+/g, "");
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}……` : clean;
}

function pathLabel(episode: RequestEpisode) {
  return episode.steps
    .map((step, i) => i === 2 ? "请求" : step.type === "NONE" ? "—" : ACTION_LABELS[step.type])
    .join(" → ");
}

// ── 小型复用组件 ────────────────────────────────────────────────

function StructureStrip({
  episodes, selected, compact = false,
}: {
  episodes: RequestEpisode[]; selected?: SelectedCell; compact?: boolean;
}) {
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
      <div className={`flex min-w-0 gap-px overflow-hidden bg-[var(--paper)] ${compact ? "h-[44px]" : "h-[58px]"}`} aria-label={pathLabel(ep)}>
        {ep.steps.map((step, i) => {
          const isReq = i === 2;
          const active = selected?.position === i && selected.type === step.type;
          const label = isReq ? "请求" : step.type === "NONE" ? "—" : ACTION_LABELS[step.type];
          const len = avgLengths[i];
          const weight = Math.max(len, step.type === "NONE" ? 5 : 8);
          return (
            <span
              className={`flex min-w-[44px] flex-col items-center justify-center px-1 text-center ${active ? "bg-[rgba(154,124,69,.13)] text-[var(--gold)]" : isReq ? "bg-[rgba(255,254,249,.96)] text-[var(--purple)] outline outline-1 -outline-offset-1 outline-[var(--purple)]" : step.type === "NONE" ? "bg-[rgba(81,78,70,.035)] text-[var(--muted)]" : "bg-[rgba(81,78,70,.09)] text-[var(--ink)]"}`}
              style={{ flexBasis: 0, flexGrow: weight }} key={i}
            >
              <b className={`${compact ? "text-[12px]" : "text-[12px]"} truncate font-normal`}>{label}</b>
              {!compact && <small className="mt-1 text-[9px] opacity-65">{step.type === "NONE" ? "无行动" : `${episodes.length > 1 ? "均" : ""}${len}字`}</small>}
            </span>
          );
        })}
      </div>
      {!compact && <p className="mt-2 text-[9px] tracking-[.06em] text-[var(--muted)]">区块宽度表示{episodes.length > 1 ? "该结构中各行动的平均原文字数" : "各行动的原文字数"}</p>}
    </div>
  );
}

// ── 结构纵览 ────────────────────────────────────────────────────

function StructureOverview() {
  return (
    <section className="mb-10">
      <h3 className="text-[18px] font-semibold tracking-[.06em] text-[var(--ink)]">结构纵览</h3>
      <p className="mt-4 max-w-[720px] text-[13px] leading-7 text-[var(--muted)]">
        叶德辉的通信行动并非随机排列。一封书信中的行动会形成一定顺序——前期的告知、赞扬或展示构成铺垫，中段的请求承担核心推进功能，后续的说明、再请求或关系维系完成收束。观察请求前后各两个行动位置的分布，可以看清这些书信的基本组织方式。
      </p>

      {/* 三段式结构示意 */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="border border-[var(--line)] bg-[rgba(255,254,249,.6)] p-5 text-center">
          <p className="text-[10px] tracking-[.14em] text-[var(--muted)]">前置行动</p>
          <p className="mt-1 text-[13px] font-normal text-[var(--ink)]">引入与铺垫</p>
          <div className="mt-3 space-y-1 font-sans text-[10px] leading-5 text-[var(--muted)]">
            <p>告知 / 赞扬 / 展示</p>
            <p>维系 / 协商 / 训导</p>
          </div>
          <p className="mt-4 text-[18px] text-[var(--muted)]">↓</p>
        </div>
        <div className="border border-[var(--purple)] bg-[rgba(255,254,249,.88)] p-5 text-center">
          <p className="text-[10px] tracking-[.14em] text-[var(--purple)]">核心行动</p>
          <p className="mt-1 text-[15px] font-normal text-[var(--purple)]">目的推进</p>
          <div className="mt-3 space-y-1 font-sans text-[10px] leading-5">
            <p className="text-[var(--purple)]">请求</p>
          </div>
          <p className="mt-4 text-[18px] text-[var(--muted)]">↓</p>
        </div>
        <div className="border border-[var(--line)] bg-[rgba(255,254,249,.6)] p-5 text-center">
          <p className="text-[10px] tracking-[.14em] text-[var(--muted)]">后置行动</p>
          <p className="mt-1 text-[13px] font-normal text-[var(--ink)]">补充与收束</p>
          <div className="mt-3 space-y-1 font-sans text-[10px] leading-5 text-[var(--muted)]">
            <p>继续说明 / 连续请求</p>
            <p>论议 / 回收 / 维系</p>
          </div>
        </div>
      </div>

      <p className="mt-5 max-w-[720px] font-sans text-[10px] leading-5 text-[var(--muted)]">
        本研究统计 298 个请求实例，并观察请求前后各两个行动位置的分布。下方的点阵矩阵中，每一行代表一种行动类型，每一列代表相对于请求的位置，圆点深浅表示该行动在相应位置出现的频率。
      </p>
    </section>
  );
}

// ── 点阵矩阵 ────────────────────────────────────────────────────

function StructureMatrix({
  episodes,
  selected,
  onSelect,
}: {
  episodes: RequestEpisode[];
  selected: SelectedCell;
  onSelect: (cell: SelectedCell) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[780px] grid-cols-[92px_repeat(2,minmax(110px,1fr))_64px_repeat(2,minmax(110px,1fr))]">
        <div />
        {POSITIONS.slice(0, 2).map((pos) => (
          <div className={`pb-3 text-center ${selected.position === pos ? "text-[var(--gold)]" : ""}`} key={pos}>
            <b className="block text-[12px] font-normal">{POSITION_META[pos].label} <i className="not-italic text-[var(--muted)]">{POSITION_META[pos].code}</i></b>
            <small className="mt-1 block text-[10px] text-[var(--muted)]">{POSITION_META[pos].phrase}</small>
          </div>
        ))}
        <div className="relative grid place-items-center pb-3 text-[13px] text-[var(--purple)] after:absolute after:bottom-0 after:left-1/2 after:h-3 after:w-px after:bg-[var(--purple)]">请求</div>
        {POSITIONS.slice(2).map((pos) => (
          <div className={`pb-3 text-center ${selected.position === pos ? "text-[var(--gold)]" : ""}`} key={pos}>
            <b className="block text-[12px] font-normal">{POSITION_META[pos].label} <i className="not-italic text-[var(--muted)]">{POSITION_META[pos].code}</i></b>
            <small className="mt-1 block text-[10px] text-[var(--muted)]">{POSITION_META[pos].phrase}</small>
          </div>
        ))}
        {STEP_ORDER.map((type) => (
          <div className="contents" key={type}>
            <div className={`flex min-h-13 items-center border-t border-[var(--line)] text-[12px] ${selected.type === type ? "text-[var(--gold)]" : ""}`}>{STEP_LABELS[type]}</div>
            {POSITIONS.slice(0, 2).map((pos) => {
              const count = countCell(episodes, { position: pos, type });
              const active = selected.position === pos && selected.type === type;
              const ratio = count / Math.max(episodes.length, 1);
              const opacity = ratio === 0 ? 0 : ratio <= 0.1 ? 0.36 : ratio <= 0.25 ? 0.55 : ratio <= 0.45 ? 0.76 : 1;
              return (
                <button key={pos} type="button" className={`grid min-h-13 place-items-center border-0 border-t border-[var(--line)] bg-transparent transition hover:bg-[rgba(255,254,249,.72)] cursor-pointer ${active ? "bg-[rgba(154,124,69,.07)]" : ""}`}
                  aria-pressed={active} aria-label={`${STEP_LABELS[type]}，${POSITION_META[pos].label}，${count}例，占${pct(count, episodes.length)}`}
                  title={`${POSITION_META[pos].phrase} · ${STEP_LABELS[type]}：${count}例，占${pct(count, episodes.length)}`}
                  onClick={() => onSelect({ position: pos, type })}>
                  <span className={`relative grid size-7 place-items-center ${active ? "after:absolute after:inset-0 after:rounded-full after:border after:border-[var(--gold)]" : ""}`}>
                    {count ? <i className="block size-3 rounded-full bg-[var(--blue)] not-italic" style={{ opacity }} /> : null}
                  </span>
                </button>
              );
            })}
            <div className="relative min-h-13 border-t border-[var(--line)] after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-[var(--line-dark)]" />
            {POSITIONS.slice(2).map((pos) => {
              const count = countCell(episodes, { position: pos, type });
              const active = selected.position === pos && selected.type === type;
              const ratio = count / Math.max(episodes.length, 1);
              const opacity = ratio === 0 ? 0 : ratio <= 0.1 ? 0.36 : ratio <= 0.25 ? 0.55 : ratio <= 0.45 ? 0.76 : 1;
              return (
                <button key={pos} type="button" className={`grid min-h-13 place-items-center border-0 border-t border-[var(--line)] bg-transparent transition hover:bg-[rgba(255,254,249,.72)] cursor-pointer ${active ? "bg-[rgba(154,124,69,.07)]" : ""}`}
                  aria-pressed={active} aria-label={`${STEP_LABELS[type]}，${POSITION_META[pos].label}，${count}例，占${pct(count, episodes.length)}`}
                  title={`${POSITION_META[pos].phrase} · ${STEP_LABELS[type]}：${count}例，占${pct(count, episodes.length)}`}
                  onClick={() => onSelect({ position: pos, type })}>
                  <span className={`relative grid size-7 place-items-center ${active ? "after:absolute after:inset-0 after:rounded-full after:border after:border-[var(--gold)]" : ""}`}>
                    {count ? <i className="block size-3 rounded-full bg-[var(--blue)] not-italic" style={{ opacity }} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 结构解释与证据 ──────────────────────────────────────────────

function StructureEvidence({
  episodes,
  selected,
  pathGroups,
}: {
  episodes: RequestEpisode[];
  selected: SelectedCell;
  pathGroups: PathGroup[];
}) {
  const mainPathGroup = pathGroups[0];
  const cellCount = countCell(episodes, selected);
  const uniqueLetters = new Set(episodes.map((ep) => ep.letter.id)).size;
  const uniqueRecipients = new Set(episodes.map((ep) => ep.recipient)).size;
  const [openEpId, setOpenEpId] = useState<string | null>(null);

  return (
    <section className="mt-8 border-t border-[var(--line)] pt-7">
      <h3 className="text-[16px] font-semibold tracking-[.05em] text-[var(--ink)]">当前结构解释</h3>

      {/* 结构路径 */}
      {mainPathGroup && (
        <div className="mt-4">
          <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">最高频完整路径</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="font-sans text-[13px] text-[var(--ink)]">
              {mainPathGroup.episodes[0].steps.map((s, i) => i === 2 ? "请求" : s.type === "NONE" ? "—" : STEP_LABELS[s.type]).join(" → ")}
            </span>
            <span className="text-[11px] text-[var(--muted)]">{mainPathGroup.episodes.length}例 · {pct(mainPathGroup.episodes.length, cellCount)}</span>
          </div>
          <div className="mt-4"><StructureStrip episodes={mainPathGroup.episodes} selected={selected} compact /></div>
        </div>
      )}

      {/* 结构解释 */}
      <div className="mt-5 rounded-sm border border-[var(--line)] bg-[rgba(255,254,249,.55)] p-4">
        <p className="text-[12px] leading-6 text-[var(--ink)]">
          <b className="font-normal text-[var(--purple)]">{STEP_LABELS[selected.type]}</b>
          {" "}位于{" "}
          <b className="font-normal text-[var(--gold)]">{POSITION_META[selected.position].phrase}</b>
          ，{selected.position < 2 ? "在请求出现之前发挥作用" : "在请求出现之后继续展开"}。
          {ACTION_MEANINGS[selected.type]}。
          {mainPathGroup && (
            <span>
              {" "}在对应的完整路径中，该行动与请求的组合在当前筛选条件下出现了 {mainPathGroup.episodes.length} 次。
            </span>
          )}
        </p>
      </div>

      {/* 统计依据 */}
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <div>
          <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">出现次数</p>
          <p className="mt-1 text-[21px] font-normal tabular-nums text-[var(--ink)]">{cellCount}<span className="mx-1 text-[11px] text-[var(--muted)]">/ {episodes.length}</span></p>
          <p className="text-[11px] text-[var(--purple)]">{pct(cellCount, episodes.length)}</p>
        </div>
        <div>
          <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">涉及书信</p>
          <p className="mt-1 text-[21px] font-normal tabular-nums text-[var(--ink)]">{uniqueLetters}<span className="mx-1 text-[11px] text-[var(--muted)]">封</span></p>
        </div>
        <div>
          <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">涉及通信对象</p>
          <p className="mt-1 text-[21px] font-normal tabular-nums text-[var(--ink)]">{uniqueRecipients}<span className="mx-1 text-[11px] text-[var(--muted)]">位</span></p>
        </div>
        <div>
          <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">路径变体</p>
          <p className="mt-1 text-[21px] font-normal tabular-nums text-[var(--ink)]">{pathGroups.length}<span className="mx-1 text-[11px] text-[var(--muted)]">种</span></p>
        </div>
      </div>

      {/* 典型书信 */}
      {episodes.length > 0 && (
        <div className="mt-7">
          <h4 className="text-[14px] font-semibold tracking-[.04em] text-[var(--ink)]">典型书信</h4>
          <p className="mt-1 font-sans text-[10px] text-[var(--muted)]">点击展开查看原文证据</p>
          <div className="mt-4 divide-y divide-[var(--line)]">
            {episodes.slice(0, 8).map((ep, i) => {
              const isOpen = openEpId === ep.id;
              return (
                <article key={ep.id} className="border-b-0">
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 border-0 bg-transparent py-3 text-left hover:bg-[rgba(255,254,249,.55)] cursor-pointer"
                    aria-expanded={isOpen}
                    onClick={() => setOpenEpId(isOpen ? null : ep.id)}
                  >
                    <span className="text-[11px] tabular-nums text-[var(--muted)] w-6 shrink-0">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[12px] text-[var(--ink)]">
                          第{ep.letter.number}通 · {ep.letter.dateLabel ?? ep.letter.year ?? "时间不详"} · 致{ep.recipient}
                        </span>
                        <span className="text-[10px] text-[var(--muted)]">{ep.request.subtype ?? "请求"} · {ep.letter.source ?? ""}</span>
                      </span>
                      <span className="mt-1 block text-[11px] leading-5 text-[var(--muted)] line-clamp-2">
                        {clippedActionText(ep.request.originalText, "请求原文暂缺", 120)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[16px] text-[var(--muted)]">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-[var(--line)] bg-[rgba(255,254,249,.45)] px-6 py-5">
                      <div className="mb-4"><StructureStrip episodes={[ep]} selected={selected} compact /></div>
                      <LetterEvidence episode={ep} selected={selected} />
                      <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3">
                        <span className="text-[10px] text-[var(--muted)]">
                          {ep.request.subtype ?? "请求"} · {ep.request.mode === "direct" ? "直接表达" : ep.request.mode === "conventionally_indirect" ? "规约性间接表达" : ep.request.mode === "non_conventionally_indirect" ? "非规约性间接表达" : "表达方式未标注"}
                        </span>
                        <Link className="text-[12px] text-[var(--purple)] hover:underline" href={sourceHref(ep)} target="_blank" rel="noopener noreferrer">
                          打开原信条目 →
                        </Link>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
            {episodes.length > 8 && (
              <p className="py-3 text-center text-[11px] text-[var(--muted)]">仅显示前 8 例，共 {episodes.length} 例</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ── 原文证据 ────────────────────────────────────────────────────

function LetterEvidence({ episode, selected }: { episode: RequestEpisode; selected: SelectedCell }) {
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
    const active = i === selected.position;
    const isReq = i === 2;
    content.push(
      <mark key={act.id} className={`px-0.5 text-[var(--ink)] ${active ? "border-b-2 border-[var(--purple)] bg-[var(--purple-pale)]" : isReq ? "border-b border-[var(--purple)] bg-[rgba(79,71,126,.08)]" : "border-b border-[var(--line-dark)] bg-transparent"}`}>
        {episode.letter.text.slice(act.start, act.end)}
      </mark>,
    );
    cursor = act.end;
  });
  content.push(episode.letter.text.slice(cursor));

  // 行动标注图例
  const allLabels = episode.steps.map((step, i) => {
    if (i === 2) return { label: "请求", isReq: true };
    if (step.type === "NONE") return null;
    return { label: STEP_LABELS[step.type], isReq: false };
  });

  return (
    <div>
      <p className="text-[10px] tracking-[.1em] text-[var(--muted)] mb-2">原文证据</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
        {allLabels.map((item, i) =>
          item ? (
            <span key={i} className={`text-[10px] ${i === 2 ? "text-[var(--purple)]" : "text-[var(--muted)]"}`}>
              {i === 2 ? "〔请求〕" : `〔${item.label}〕`}
              {i < 4 && <span className="mx-1 text-[var(--line-dark)]">→</span>}
            </span>
          ) : null
        )}
      </div>
      <p className="whitespace-pre-wrap text-[14px] leading-9 text-[var(--ink)]">{content}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1"><i className="h-1.5 w-3 border-b-2 border-[var(--purple)] bg-[var(--purple-pale)] not-italic" />当前选中行动</span>
        <span className="inline-flex items-center gap-1"><i className="h-1.5 w-3 border-b border-[var(--purple)] bg-[rgba(79,71,126,.08)] not-italic" />请求</span>
        <span className="inline-flex items-center gap-1"><i className="h-1.5 w-3 border-b border-[var(--line-dark)] not-italic" />其他行动</span>
      </div>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────────

export default function CommunicationAnalysis() {
  const [recipient, setRecipient] = useState<string>("松崎鹤雄");
  const [domain, setDomain] = useState<EventType | "ALL">("ALL");
  const [selected, setSelected] = useState<SelectedCell>({ position: 1, type: "AST" });
  const [showPaths, setShowPaths] = useState(false);

  const filteredEpisodes = useMemo(() => {
    let eps = ALL_EPISODES.filter((ep) => ep.recipient === recipient);
    if (domain !== "ALL") {
      eps = eps.filter((ep) => ep.domain === domain);
    }
    return eps;
  }, [recipient, domain]);

  const cellEpisodes = useMemo(() => {
    return filteredEpisodes.filter((ep) => ep.steps[selected.position].type === selected.type);
  }, [filteredEpisodes, selected]);

  const pathGroups = useMemo(() => groupByPath(cellEpisodes), [cellEpisodes]);

  const cellCount = countCell(filteredEpisodes, selected);

  return (
    <div>
      {/* 研究说明 */}
      <p className="mx-auto max-w-[680px] text-center font-sans text-[11px] leading-6 text-[var(--muted)]" style={{ textWrap: "balance" }}>
        在 178 封含有请求的书信中，叶德辉的通信行动呈现出一定的结构规律。选择通信对象和事务类型，观察请求前后各两个位置的行动分布，点击圆点查看具体结构的解释与原信证据。
      </p>

      {/* 一、结构纵览 */}
      <div className="mt-8">
        <StructureOverview />
      </div>

      {/* 二、请求前后的行动分布 */}
      <section className="mt-8">
        <p className="text-[11px] font-semibold tracking-[.16em] text-[var(--green)]">单组分析</p>
        <h3 className="mt-1 text-[23px] font-semibold tracking-[.04em] text-[var(--ink)]">请求前后的行动分布</h3>
        <p className="mt-2 font-sans text-[11px] leading-5 text-[var(--muted)]">
          点击墨点选择现象，棋盘下方会先解释它代表什么。
        </p>

        {/* 筛选条件 */}
        <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-3 border-b border-[var(--line)] pb-4 text-[12px] text-[var(--muted)]">
          <span>查看叶德辉致</span>
          <span className="relative inline-flex items-baseline">
            <label className="sr-only" htmlFor="ca-recipient">通信对象</label>
            <select
              id="ca-recipient"
              className="appearance-none border-0 border-b border-[var(--line-dark)] bg-transparent py-0.5 pl-0 pr-5 font-serif text-[14px] text-[var(--ink)] outline-none focus:border-[var(--purple)]"
              value={recipient}
              onChange={(e) => { setRecipient(e.target.value); }}
            >
              {PREFERRED_RECIPIENTS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 text-[11px] text-[var(--purple)]" aria-hidden="true">⌄</span>
          </span>
          <span>的</span>
          <span className="relative inline-flex items-baseline">
            <label className="sr-only" htmlFor="ca-domain">事务类型</label>
            <select
              id="ca-domain"
              className="appearance-none border-0 border-b border-[var(--line-dark)] bg-transparent py-0.5 pl-0 pr-5 font-serif text-[14px] text-[var(--ink)] outline-none focus:border-[var(--purple)]"
              value={domain}
              onChange={(e) => { setDomain(e.target.value as EventType | "ALL"); }}
            >
              {DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 text-[11px] text-[var(--purple)]" aria-hidden="true">⌄</span>
          </span>
          <span>请求结构 · {filteredEpisodes.length}例</span>
        </div>

        {/* 图例 */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 font-sans text-[10px] text-[var(--muted)]">
          <div className="flex items-center gap-4" aria-label="圆点墨色越深，出现越频繁">
            <span>少见</span>
            <span className="flex items-center gap-1">
              <i className="block size-2.5 rounded-full bg-[var(--blue)] not-italic" style={{ opacity: 0.36 }} />
              <i className="block size-2.5 rounded-full bg-[var(--blue)] not-italic" style={{ opacity: 0.55 }} />
              <i className="block size-2.5 rounded-full bg-[var(--blue)] not-italic" style={{ opacity: 0.76 }} />
              <i className="block size-2.5 rounded-full bg-[var(--blue)] not-italic" style={{ opacity: 1 }} />
            </span>
            <span>常见</span>
          </div>
          <button
            type="button"
            className={`border-0 border-b bg-transparent pb-0.5 text-[11px] ${showPaths ? "border-[var(--green)] text-[var(--green)]" : "border-[var(--line-dark)] text-[var(--muted)]"}`}
            aria-pressed={showPaths}
            onClick={() => setShowPaths((value) => !value)}
          >
            {showPaths ? "隐藏常见结构" : "显示常见结构"}
          </button>
        </div>

        {/* 点阵矩阵 */}
        <div className="mt-4">
          <StructureMatrix episodes={filteredEpisodes} selected={selected} onSelect={setSelected} />
        </div>

        {/* 矩阵选中信息 */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--muted)]">
          <span>当前：{POSITION_META[selected.position].label} · {STEP_LABELS[selected.type]} · {cellCount}/{filteredEpisodes.length}例 · {pct(cellCount, filteredEpisodes.length)}</span>
          {pathGroups[0] && <span>最高频路径：{pathGroups[0].episodes.length}例</span>}
        </div>
        {pathGroups[0] && (
          <div className="mt-4">
            <StructureStrip episodes={pathGroups[0].episodes} selected={selected} compact />
          </div>
        )}

        {showPaths && (
          <div className="mt-5 border-y border-[var(--line)] py-5">
            <p className="text-[11px] tracking-[.12em] text-[var(--muted)]">当前筛选中的常见结构</p>
            <div className="mt-4 space-y-4">
              {pathGroups.slice(0, 3).map((group, index) => (
                <div className="grid gap-3 border-b border-[var(--line)] pb-3 sm:grid-cols-[24px_minmax(0,1fr)_70px] sm:items-center" key={group.key}>
                  <span className="text-[10px] text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span>
                  <StructureStrip episodes={group.episodes} selected={selected} compact />
                  <span className="text-right text-[10px] leading-4 text-[var(--muted)]">{group.episodes.length}例<br />{pct(group.episodes.length, cellEpisodes.length)}</span>
                </div>
              ))}
              {!pathGroups.length && <p className="text-[11px] text-[var(--muted)]">当前选择下没有完整结构</p>}
            </div>
          </div>
        )}
      </section>

      {/* 三、结构解释与证据 */}
      {cellCount > 0 && (
        <StructureEvidence episodes={cellEpisodes} selected={selected} pathGroups={pathGroups} />
      )}
    </div>
  );
}
