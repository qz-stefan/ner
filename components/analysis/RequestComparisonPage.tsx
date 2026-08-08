"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { dataset } from "@/lib/data-adapter";
import type { ActMention, ActType, EventType, Letter } from "@/lib/types";

type StepType = ActType | "NONE";
type Position = 0 | 1 | 3 | 4;
type Screen = "overview" | "reading";

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

interface HoverPoint {
  cell: SelectedCell;
  x: number;
  y: number;
}

interface PathGroup {
  key: string;
  episodes: RequestEpisode[];
}

const PREFERRED_RECIPIENTS = [
  "松崎鹤雄",
  "缪荃孙",
  "孙毓修",
  "易培基",
  "夏敬观",
  "吴庆坻",
  "杨树达",
  "刘承干",
] as const;

const POSITIONS: Position[] = [0, 1, 3, 4];
const POSITION_META: Record<Position, { label: string; phrase: string; code: string }> = {
  0: { label: "前两步", phrase: "请求前第2个行动", code: "−2" },
  1: { label: "前一步", phrase: "紧邻请求之前", code: "−1" },
  3: { label: "后一步", phrase: "紧随请求之后", code: "+1" },
  4: { label: "后两步", phrase: "请求后第2个行动", code: "+2" },
};

const ACTION_ORDER: StepType[] = ["AST", "DIR", "EXP", "COM", "NONE"];
const ACTION_LABELS: Record<StepType, string> = {
  AST: "陈述",
  DIR: "连续请求",
  EXP: "表达",
  COM: "承诺",
  NONE: "无行动",
};

const ACTION_MEANINGS: Record<StepType, string> = {
  AST: "交代事实、进展或背景",
  DIR: "连续提出另一项请求",
  EXP: "维持关系或表达关切",
  COM: "协商条件与处理方式",
  NONE: "没有出现其他已标注行动",
};

const DOMAINS: Array<{ value: EventType | "ALL"; label: string }> = [
  { value: "ALL", label: "全部事务" },
  { value: "BIB", label: "文献活动" },
  { value: "SOC", label: "社会交往" },
  { value: "ACA", label: "学术活动" },
  { value: "POL", label: "政治时局" },
  { value: "FAM", label: "家族事务" },
];

const MODE_LABELS: Record<string, string> = {
  direct: "直接表达",
  conventionally_indirect: "规约性间接表达",
  non_conventionally_indirect: "非规约性间接表达",
};

function linkedDomain(letterId: string, request: ActMention): EventType | "UNK" {
  const events = dataset.eventsByLetter[letterId] ?? [];
  for (const link of request.eventLinks) {
    const event = events.find((candidate) => candidate.id === link.eventId);
    if (event) return event.type;
  }
  const domain = request.contentDomains.find((item) =>
    ["DOM-BIB", "DOM-ACA", "DOM-SOC", "DOM-POL", "DOM-FAM"].includes(item),
  );
  return domain ? (domain.slice(4) as EventType) : "UNK";
}

function makeEpisodes(): RequestEpisode[] {
  const letterMap = new Map(dataset.letters.map((letter) => [letter.id, letter]));
  return Object.entries(dataset.actsByLetter).flatMap(([letterId, rawActs]) => {
    const letter = letterMap.get(letterId);
    if (!letter) return [];
    const acts = [...rawActs].sort((a, b) => a.start - b.start);
    return acts.flatMap((request, index) => {
      if (request.type !== "DIR") return [];
      const step = (offset: number): EpisodeStep => {
        const act = acts[index + offset] ?? null;
        return { type: act?.type ?? "NONE", act };
      };
      const steps: RequestEpisode["steps"] = [
        step(-2),
        step(-1),
        { type: "DIR", act: request },
        step(1),
        step(2),
      ];
      return [{
        id: request.id,
        letter,
        request,
        recipient: letter.recipient,
        domain: linkedDomain(letterId, request),
        steps,
        pathKey: steps.map((item) => item.type).join(">"),
      }];
    });
  });
}

const ALL_EPISODES = makeEpisodes();

function countCell(episodes: RequestEpisode[], cell: SelectedCell) {
  return episodes.filter((episode) => episode.steps[cell.position].type === cell.type).length;
}

function pct(count: number, total: number) {
  return total ? `${Math.round((count / total) * 100)}%` : "—";
}

function pathLabel(episode: RequestEpisode) {
  return episode.steps
    .map((step, index) => index === 2 ? "请求" : step.type === "NONE" ? "—" : ACTION_LABELS[step.type])
    .join(" → ");
}

function clippedActionText(text: string | undefined, fallback: string, maxLength = 72) {
  if (!text) return fallback;
  const clean = text.replace(/\s+/g, "");
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}……` : clean;
}

function sourceHref(episode: RequestEpisode) {
  const params = new URLSearchParams({
    q: episode.request.originalText,
    scope: "fulltext",
    at: String(episode.request.start),
    act: episode.request.id,
  });
  return `/letter/${encodeURIComponent(episode.letter.id)}?${params.toString()}`;
}

function groupByPath(episodes: RequestEpisode[]): PathGroup[] {
  const groups = new Map<string, RequestEpisode[]>();
  for (const episode of episodes) {
    const current = groups.get(episode.pathKey) ?? [];
    current.push(episode);
    groups.set(episode.pathKey, current);
  }
  return [...groups.entries()]
    .map(([key, items]) => ({ key, episodes: items }))
    .sort((a, b) => b.episodes.length - a.episodes.length);
}

function StructureStrip({
  episodes,
  selected,
  compact = false,
}: {
  episodes: RequestEpisode[];
  selected?: SelectedCell;
  compact?: boolean;
}) {
  const episode = episodes[0];
  const averageLengths = episode.steps.map((_, stepIndex) => {
    const total = episodes.reduce((sum, item) => {
      const text = item.steps[stepIndex].act?.originalText ?? "";
      return sum + text.replace(/\s+/g, "").length;
    }, 0);
    return Math.round(total / Math.max(episodes.length, 1));
  });

  return (
    <div>
      <div
        className={`flex min-w-0 gap-px overflow-hidden bg-[var(--paper)] ${compact ? "h-[44px]" : "h-[58px]"}`}
        aria-label={`${pathLabel(episode)}；区块宽度表示平均原文字数`}
      >
      {episode.steps.map((step, index) => {
        const isRequest = index === 2;
        const active = selected?.position === index && selected.type === step.type;
        const label = isRequest ? "请求" : step.type === "NONE" ? "—" : ACTION_LABELS[step.type];
        const length = averageLengths[index];
        const weight = Math.max(length, step.type === "NONE" ? 5 : 8);
        return (
          <span
            className={`flex min-w-[44px] flex-col items-center justify-center px-1 text-center ${
              active
                ? "bg-[rgba(154,124,69,.13)] text-[var(--gold)]"
                : isRequest
                  ? "bg-[rgba(255,254,249,.96)] text-[var(--purple)] outline outline-1 -outline-offset-1 outline-[var(--purple)]"
                  : step.type === "NONE"
                    ? "bg-[rgba(81,78,70,.035)] text-[var(--muted)]"
                    : "bg-[rgba(81,78,70,.09)] text-[var(--ink)]"
            }`}
            style={{ flexBasis: 0, flexGrow: weight }}
            key={`${step.act?.id ?? "none"}-${index}`}
          >
            <b className={`${compact ? "text-[12px]" : "text-[12px]"} truncate font-normal`}>
              {label}
            </b>
            {!compact && (
              <small className="mt-1 text-[9px] opacity-65">
                {step.type === "NONE" ? "无行动" : `${episodes.length > 1 ? "均" : ""}${length}字`}
              </small>
            )}
          </span>
        );
      })}
      </div>
      {!compact && (
        <p className="mt-2 text-[9px] tracking-[.06em] text-[var(--muted)]">
          区块宽度表示{episodes.length > 1 ? "该结构中各行动的平均原文字数" : "各行动的原文字数"}
        </p>
      )}
    </div>
  );
}

function StructureCompass({
  episodes,
  selected,
  compact = false,
}: {
  episodes: RequestEpisode[];
  selected?: SelectedCell;
  compact?: boolean;
}) {
  const episode = episodes[0];
  const labels = ["前两步", "前一步", "核心", "后一步", "后两步"];
  return (
    <div className="grid grid-cols-5 gap-2" aria-label={pathLabel(episode)}>
      {episode.steps.map((step, index) => {
        const isRequest = index === 2;
        const active = selected?.position === index && selected.type === step.type;
        const action = isRequest ? "请求" : step.type === "NONE" ? "—" : ACTION_LABELS[step.type];
        return (
          <span
            className={`min-w-0 text-center ${compact ? "py-2" : "py-3"} ${
              active ? "bg-[rgba(154,124,69,.11)]" : ""
            }`}
            key={`${step.act?.id ?? "none"}-${index}`}
          >
            <small className="block text-[9px] tracking-[.08em] text-[var(--muted)]">{labels[index]}</small>
            <b
              className={`mt-2 block truncate font-normal ${
                compact ? "text-[13px]" : "text-[15px]"
              } ${active ? "text-[var(--gold)]" : isRequest ? "text-[var(--purple)]" : "text-[var(--ink)]"}`}
            >
              {isRequest ? `〔${action}〕` : action}
            </b>
          </span>
        );
      })}
    </div>
  );
}

function LetterPositionGlyph({ selected }: { selected: SelectedCell }) {
  const lineWidths = ["74%", "88%", "62%", "81%", "68%"];
  return (
    <figure className="flex items-center gap-5" aria-label={`书信缩略图：${POSITION_META[selected.position].label}为${ACTION_LABELS[selected.type]}，之后进入请求`}>
      <div className="relative h-[92px] w-[70px] shrink-0 bg-[rgba(255,254,249,.88)] px-3 py-3 shadow-[0_7px_20px_rgba(34,31,27,.08)]">
        <span className="absolute right-0 top-0 size-3 border-b border-l border-[var(--line)] bg-[var(--paper)]" aria-hidden="true" />
        <div className="flex h-full flex-col justify-around">
          {[0, 1, 2, 3, 4].map((index) => {
            const active = selected.position === index;
            const request = index === 2;
            return (
              <span
                className={`flex h-[10px] items-center px-1 text-[6px] leading-none ${
                  active
                    ? "bg-[var(--gold)] text-white"
                    : request
                      ? "border-b border-[var(--purple)] bg-[var(--purple-pale)] text-[var(--purple)]"
                      : "bg-[rgba(81,78,70,.10)] text-transparent"
                }`}
                style={{ width: lineWidths[index] }}
                key={index}
              >
                {active ? ACTION_LABELS[selected.type] : request ? "请求" : "文"}
              </span>
            );
          })}
        </div>
      </div>
      <figcaption className="min-w-0">
        <p className="text-[10px] tracking-[.12em] text-[var(--muted)]">在一封信里的位置</p>
        <p className="mt-2 text-[12px] leading-6 text-[var(--ink)]">
          赭色句段是“{ACTION_LABELS[selected.type]}”，它位于
          <b className="mx-1 font-normal text-[var(--gold)]">{POSITION_META[selected.position].phrase}</b>。
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-3 bg-[var(--gold)] not-italic" />当前行动</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-3 border-b border-[var(--purple)] bg-[var(--purple-pale)] not-italic" />请求</span>
        </div>
      </figcaption>
    </figure>
  );
}

function ConsensusSkeleton({
  episodes,
  selected,
}: {
  episodes: RequestEpisode[];
  selected: SelectedCell;
}) {
  const profiles = [0, 1, 2, 3, 4].map((position) => {
    const counts = new Map<StepType, number>();
    for (const episode of episodes) {
      const type = episode.steps[position].type;
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return {
      position,
      primary: ordered[0] ?? ["NONE", 0] as [StepType, number],
      alternatives: ordered.slice(1, 3),
    };
  });
  const variable = profiles
    .filter((profile) => profile.position !== selected.position && profile.position !== 2)
    .sort((a, b) => (a.primary[1] / Math.max(episodes.length, 1)) - (b.primary[1] / Math.max(episodes.length, 1)))[0];
  const labels = ["前两步", "前一步", "核心", "后一步", "后两步"];

  return (
    <figure>
      <div className="grid grid-cols-5 gap-3">
        {profiles.map((profile) => {
          const [primaryType, primaryCount] = profile.primary;
          const fixed = profile.position === selected.position || profile.position === 2;
          const share = primaryCount / Math.max(episodes.length, 1);
          const primaryLabel = profile.position === 2 ? "请求" : primaryType === "NONE" ? "—" : ACTION_LABELS[primaryType];
          return (
            <div className="min-w-0 py-3 text-center" key={profile.position}>
              <p className={`text-[9px] tracking-[.1em] ${fixed ? "text-[var(--purple)]" : "text-[var(--muted)]"}`}>
                {labels[profile.position]}
              </p>
              <div className="mt-4 min-h-[54px]">
                <p
                  className={`truncate text-[17px] ${fixed ? "text-[var(--purple)]" : "text-[var(--ink)]"}`}
                  style={{ opacity: fixed ? 1 : 0.48 + share * 0.52 }}
                >
                  {primaryLabel}
                </p>
                <p className="mt-1 text-[9px] tabular-nums text-[var(--muted)]">
                  {fixed ? "已固定" : `${primaryCount}/${episodes.length} 一致`}
                </p>
              </div>
              {!fixed && profile.alternatives.length > 0 && (
                <div className="mt-2 min-h-[32px] border-t border-[var(--line)] pt-2 text-[9px] leading-4 text-[var(--muted)]">
                  {profile.alternatives.map(([type, count]) => (
                    <span className="mr-2 inline-block whitespace-nowrap" key={type}>
                      {type === "NONE" ? "无行动" : ACTION_LABELS[type]} {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {variable && (
        <figcaption className="mt-5 border-t border-[var(--line)] pt-4 text-[12px] leading-6 text-[var(--muted)]">
          在已固定“{POSITION_META[selected.position].label}·{ACTION_LABELS[selected.type]}”的 {episodes.length} 例中，
          <b className="mx-1 font-normal text-[var(--ink)]">{labels[variable.position]}</b>
          分歧最大；最常见的“{variable.primary[0] === "NONE" ? "无行动" : ACTION_LABELS[variable.primary[0]]}”
          只覆盖 {variable.primary[1]}/{episodes.length} 例。
        </figcaption>
      )}
    </figure>
  );
}

function ComparisonTracks({
  typical,
  alternative,
  selected,
  typicalCount,
  alternativeCount,
  total,
}: {
  typical: RequestEpisode;
  alternative: RequestEpisode;
  selected: SelectedCell;
  typicalCount: number;
  alternativeCount: number;
  total: number;
}) {
  const beforeRequest = selected.position < 2;
  const windowPositions = beforeRequest ? [selected.position, 2] : [2, selected.position];
  const labelAt = (episode: RequestEpisode, position: number) => {
    if (position === 2) return "请求";
    const type = episode.steps[position].type;
    return type === "NONE" ? "—" : ACTION_LABELS[type];
  };
  const track = (episode: RequestEpisode, alternativeTrack: boolean) => (
    <div className="grid grid-cols-[28px_repeat(2,minmax(96px,160px))_28px] items-center gap-2">
      <span className="text-center text-[12px] text-[var(--muted)]">…</span>
      {windowPositions.map((position) => {
        const active = position === selected.position;
        return (
          <span
            className={`grid min-h-[54px] place-items-center px-3 text-center text-[13px] ${
              active
                ? alternativeTrack
                  ? "border border-[var(--gold)] bg-[rgba(255,254,249,.76)] text-[var(--ink)]"
                  : "bg-[var(--gold)] text-white"
                : "bg-[var(--purple-pale)] text-[var(--purple)]"
            }`}
            key={`${episode.id}-${position}`}
          >
            {labelAt(episode, position)}
          </span>
        );
      })}
      <span className="text-center text-[12px] text-[var(--muted)]">…</span>
    </div>
  );

  return (
    <figure className="mx-auto max-w-[720px]">
      <div className="ml-[112px] grid grid-cols-[28px_repeat(2,minmax(96px,160px))_28px] gap-2 pb-2 text-center text-[9px] tracking-[.08em] text-[var(--muted)]">
        <span />
        {windowPositions.map((position) => (
          <span className={position === selected.position ? "text-[var(--gold)]" : ""} key={position}>
            {position === 2 ? "核心" : POSITION_META[position as Position].label}
          </span>
        ))}
        <span />
      </div>
      <div className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
        <div>
          <p className="text-[11px] text-[var(--gold)]">常见写法</p>
          <p className="mt-1 text-[10px] tabular-nums text-[var(--muted)]">{typicalCount}/{total} · {pct(typicalCount, total)}</p>
        </div>
        {track(typical, false)}
        <div>
          <p className="text-[11px] text-[var(--ink)]">替代写法</p>
          <p className="mt-1 text-[10px] tabular-nums text-[var(--muted)]">{alternativeCount}/{total} · {pct(alternativeCount, total)}</p>
        </div>
        {track(alternative, true)}
      </div>
    </figure>
  );
}

function DataSummary({
  current,
  total,
  mainPathCount,
  pathCount,
}: {
  current: number;
  total: number;
  mainPathCount: number;
  pathCount: number;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <div>
        <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">出现频率</p>
        <p className="mt-2 text-[23px] font-normal tabular-nums">
          {current}<span className="mx-1 text-[12px] text-[var(--muted)]">/</span>{total}
        </p>
        <p className="mt-1 text-[11px] text-[var(--purple)]">{pct(current, total)}</p>
      </div>
      <div>
        <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">路径集中度</p>
        <p className="mt-2 text-[23px] font-normal tabular-nums">
          {mainPathCount}<span className="mx-1 text-[12px] text-[var(--muted)]">/</span>{current || 0}
        </p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">{pct(mainPathCount, current)}属于最高频结构</p>
      </div>
      <div>
        <p className="text-[10px] tracking-[.1em] text-[var(--muted)]">结构变体</p>
        <p className="mt-2 text-[23px] font-normal tabular-nums">{pathCount}</p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">种完整行动结构</p>
      </div>
    </div>
  );
}

function EpisodeLetter({ episode, selected }: { episode: RequestEpisode; selected: SelectedCell }) {
  const marks = episode.steps
    .map((step, index) => ({ act: step.act, index }))
    .filter((item): item is { act: ActMention; index: number } => Boolean(item.act))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.act.id === item.act.id) === index)
    .sort((a, b) => a.act.start - b.act.start);
  const content: ReactNode[] = [];
  let cursor = 0;

  marks.forEach(({ act, index }) => {
    if (act.start < cursor) return;
    content.push(episode.letter.text.slice(cursor, act.start));
    const active = index === selected.position;
    const isRequest = index === 2;
    content.push(
      <mark
        className={`px-0.5 text-[var(--ink)] ${
          active
            ? "border-b-2 border-[var(--purple)] bg-[var(--purple-pale)]"
            : isRequest
              ? "border-b border-[var(--purple)] bg-[rgba(79,71,126,.08)]"
              : "border-b border-[var(--line-dark)] bg-transparent"
        }`}
        key={act.id}
      >
        {episode.letter.text.slice(act.start, act.end)}
      </mark>,
    );
    cursor = act.end;
  });
  content.push(episode.letter.text.slice(cursor));

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[.12em] text-[var(--muted)]">完整原信</p>
          <h4 className="mt-1 text-[18px] font-normal">
            第{episode.letter.number}通 · {episode.letter.dateLabel ?? episode.letter.year ?? "时间不详"}
          </h4>
        </div>
        <p className="text-[10px] text-[var(--muted)]">紫色实线：当前行动　浅色下划线：相邻行动</p>
      </div>
      <div className="mx-auto max-w-[820px] py-6">
        <p className="whitespace-pre-wrap text-[14px] leading-9 text-[var(--ink)]">{content}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
        <p className="text-[11px] text-[var(--muted)]">
          {episode.request.subtype ?? "请求"} · {MODE_LABELS[episode.request.mode as keyof typeof MODE_LABELS] ?? episode.request.mode ?? "表达方式未标注"}
        </p>
        <Link className="text-[12px] text-[var(--purple)] hover:underline" href={sourceHref(episode)}>
          打开原信条目 →
        </Link>
      </div>
    </div>
  );
}

function EvidenceRow({
  episode,
  index,
  selected,
  pathEpisodes,
  pathTotal,
  pathOpen,
  onTogglePath,
  openEpisodeId,
  onToggleEpisode,
}: {
  episode: RequestEpisode;
  index: number;
  selected: SelectedCell;
  pathEpisodes: RequestEpisode[];
  pathTotal: number;
  pathOpen: boolean;
  onTogglePath: () => void;
  openEpisodeId: string | null;
  onToggleEpisode: (id: string) => void;
}) {
  const selectedAct = episode.steps[selected.position].act;
  const selectedText = clippedActionText(
    selectedAct?.originalText,
    selected.type === "NONE" ? "此处没有出现其他已标注行动" : "该行动未保留原文片段",
  );
  const requestText = clippedActionText(episode.request.originalText, "请求原文未标注");

  return (
    <article className="border-b border-[var(--line)]">
      <button
        type="button"
        className="grid w-full grid-cols-[30px_minmax(0,1fr)_20px] gap-4 border-0 bg-transparent py-5 text-left hover:bg-[rgba(255,254,249,.55)] focus-visible:outline-1 focus-visible:outline-[var(--purple)]"
        aria-expanded={pathOpen}
        onClick={onTogglePath}
      >
        <span className="pt-1 text-[11px] tabular-nums text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-[var(--muted)]">
            <span>第{episode.letter.number}通 · {episode.letter.year ?? "时间不详"} · {episode.request.subtype ?? "请求"}</span>
            <span className="text-[var(--purple)]">
              同路径 {pathEpisodes.length}/{pathTotal}例 · {pct(pathEpisodes.length, pathTotal)} · {pathOpen ? "收起" : "展开"}
            </span>
          </span>
          <span className="mt-4 grid gap-5 lg:grid-cols-[minmax(250px,.8fr)_minmax(300px,1.2fr)] lg:items-center">
            <StructureStrip episodes={[episode]} selected={selected} compact />
            <span className="grid gap-3">
              <span className="grid grid-cols-[58px_minmax(0,1fr)] gap-3">
                <small className="pt-1 text-[10px] tracking-[.08em] text-[var(--purple)]">
                  {ACTION_LABELS[selected.type]}
                </small>
                <span className="font-serif text-[12px] leading-6 text-[var(--ink)]">
                  “{selectedText}”
                </span>
              </span>
              <span className="grid grid-cols-[58px_minmax(0,1fr)] gap-3">
                <small className="pt-1 text-[10px] tracking-[.08em] text-[var(--muted)]">提出请求</small>
                <span className="font-serif text-[12px] leading-6 text-[var(--ink)]">
                  “{requestText}”
                </span>
              </span>
            </span>
          </span>
        </span>
        <span className={`pt-1 text-[13px] text-[var(--purple)] transition ${pathOpen ? "rotate-45" : ""}`}>＋</span>
      </button>
      {pathOpen && (
        <div className="mb-6 ml-[46px] bg-[rgba(255,254,249,.62)] px-5 py-2">
          <p className="border-b border-[var(--line)] py-3 text-[10px] tracking-[.1em] text-[var(--muted)]">
            采用这一完整结构的全部 {pathEpisodes.length} 个请求实例
          </p>
          {pathEpisodes.map((item, memberIndex) => {
            const memberOpen = openEpisodeId === item.id;
            return (
              <div className="border-b border-[var(--line)] last:border-b-0" key={item.id}>
                <button
                  type="button"
                  className="grid w-full grid-cols-[24px_130px_minmax(0,1fr)_70px] items-start gap-3 border-0 bg-transparent py-4 text-left hover:text-[var(--purple)]"
                  aria-expanded={memberOpen}
                  onClick={() => onToggleEpisode(item.id)}
                >
                  <span className="text-[10px] tabular-nums text-[var(--muted)]">
                    {String(memberIndex + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[11px] text-[var(--ink)]">
                    第{item.letter.number}通 · {item.letter.year ?? "时间不详"}
                  </span>
                  <span className="truncate text-[12px] text-[var(--muted)]">“{clippedActionText(item.request.originalText, "请求原文未标注", 54)}”</span>
                  <span className="text-right text-[10px] text-[var(--purple)]">{memberOpen ? "收起原文 ↑" : "查看原文 ↓"}</span>
                </button>
                {memberOpen && (
                  <div className="px-4 pb-5">
                    <EpisodeLetter episode={item} selected={selected} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function SectionHeading({ no, title, note }: { no: string; title: string; note: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--ink)] pb-3">
      <div className="flex items-baseline gap-4">
        <span className="text-[11px] tracking-[.14em] text-[var(--muted)]">{no}</span>
        <h2 className="text-[21px] font-medium tracking-[.04em]">{title}</h2>
      </div>
      <p className="text-[11px] text-[var(--muted)]">{note}</p>
    </header>
  );
}

export function RequestComparisonPage() {
  const recipients = useMemo(() => {
    const available = new Set(ALL_EPISODES.map((episode) => episode.recipient));
    return PREFERRED_RECIPIENTS.filter((name) => available.has(name));
  }, []);
  const [recipient, setRecipient] = useState("缪荃孙");
  const [domain, setDomain] = useState<EventType | "ALL">("BIB");
  const [selected, setSelected] = useState<SelectedCell>({ position: 1, type: "AST" });
  const [screen, setScreen] = useState<Screen>("overview");
  const [showPaths, setShowPaths] = useState(false);
  const [showAllTypical, setShowAllTypical] = useState(false);
  const [openPathKey, setOpenPathKey] = useState<string | null>(null);
  const [openEpisodeId, setOpenEpisodeId] = useState<string | null>(null);
  const [comparisonType, setComparisonType] = useState<StepType | null>(null);
  const [showCounterSource, setShowCounterSource] = useState(false);
  const [showOverviewTable, setShowOverviewTable] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<HoverPoint | null>(null);

  const recipientEpisodes = useMemo(
    () => recipient === "ALL"
      ? ALL_EPISODES
      : ALL_EPISODES.filter((episode) => episode.recipient === recipient),
    [recipient],
  );
  const episodes = useMemo(
    () => recipientEpisodes.filter((episode) => domain === "ALL" || episode.domain === domain),
    [recipientEpisodes, domain],
  );
  const matches = useMemo(
    () => episodes.filter((episode) => episode.steps[selected.position].type === selected.type),
    [episodes, selected],
  );
  const pathGroups = useMemo(() => groupByPath(matches), [matches]);
  const counterEpisodes = useMemo(
    () => episodes.filter((episode) => episode.steps[selected.position].type !== selected.type),
    [episodes, selected],
  );
  const alternativeOptions = useMemo(() => {
    const counts = new Map<StepType, number>();
    for (const episode of counterEpisodes) {
      const type = episode.steps[selected.position].type;
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [counterEpisodes, selected.position]);
  const activeComparisonType =
    comparisonType && alternativeOptions.some((option) => option.type === comparisonType)
      ? comparisonType
      : alternativeOptions[0]?.type ?? null;
  const comparisonCandidates = useMemo(
    () => activeComparisonType
      ? counterEpisodes.filter((episode) => episode.steps[selected.position].type === activeComparisonType)
      : [],
    [counterEpisodes, activeComparisonType, selected.position],
  );
  const controlledPair = useMemo(() => {
    let best: { typical: RequestEpisode; alternative: RequestEpisode; score: number } | null = null;
    for (const typical of matches) {
      for (const alternative of comparisonCandidates) {
        const score = [0, 1, 3, 4].reduce((sum, position) => {
          if (position === selected.position) return sum;
          return sum + (typical.steps[position].type === alternative.steps[position].type ? 1 : 0);
        }, 0);
        if (!best || score > best.score) best = { typical, alternative, score };
      }
    }
    return best;
  }, [matches, comparisonCandidates, selected.position]);
  const comparisonEpisodes = useMemo(
    () => recipient === "ALL"
      ? ALL_EPISODES
      : ALL_EPISODES.filter((episode) => domain === "ALL" || episode.domain === domain),
    [recipient, domain],
  );
  const comparisonMatches = useMemo(
    () => comparisonEpisodes.filter((episode) => episode.steps[selected.position].type === selected.type),
    [comparisonEpisodes, selected],
  );
  const domainName = DOMAINS.find((item) => item.value === domain)?.label ?? "全部事务";
  const recipientName = recipient === "ALL" ? "所有通信对象" : `致${recipient}`;
  const mainPathGroup = pathGroups[0] ?? null;
  const mainEpisode = mainPathGroup?.episodes[0] ?? null;
  const pairedTypicalEpisode = controlledPair?.typical ?? null;
  const counterEpisode = controlledPair?.alternative ?? null;
  const counterTypeCount = alternativeOptions.find((option) => option.type === activeComparisonType)?.count ?? 0;
  const visibleTypicalGroups = showAllTypical ? pathGroups : pathGroups.slice(0, 3);
  const currentShare = episodes.length ? matches.length / episodes.length : 0;
  const comparisonShare = comparisonEpisodes.length ? comparisonMatches.length / comparisonEpisodes.length : 0;
  const deltaPoints = Math.round((currentShare - comparisonShare) * 100);

  function chooseCell(cell: SelectedCell) {
    setSelected(cell);
    setShowAllTypical(false);
    setOpenPathKey(null);
    setOpenEpisodeId(null);
    setComparisonType(null);
    setShowCounterSource(false);
    setShowOverviewTable(false);
  }

  function enterReading() {
    setShowAllTypical(false);
    setOpenPathKey(null);
    setOpenEpisodeId(null);
    setComparisonType(null);
    setShowCounterSource(false);
    setScreen("reading");
  }

  function previewCell(element: HTMLElement, cell: SelectedCell) {
    const rect = element.getBoundingClientRect();
    setHoveredPoint({
      cell,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }

  if (screen === "reading") {
    const question = matches.length
      ? `为什么“${ACTION_LABELS[selected.type]}”常出现在${POSITION_META[selected.position].phrase}？`
      : `为什么${POSITION_META[selected.position].phrase}没有出现“${ACTION_LABELS[selected.type]}”？`;
    return (
      <main className="min-h-[calc(100vh-64px)] bg-[var(--paper)] pb-24 font-serif">
        <div className="site-container">
          <article className="mx-auto max-w-[940px]">
            <header className="py-8">
              <button
                type="button"
                className="border-0 bg-transparent p-0 text-[11px] tracking-[.12em] text-[var(--purple)] hover:underline"
                onClick={() => setScreen("overview")}
              >
                ← 返回结构纵览
              </button>
              <p className="mt-7 text-[11px] font-semibold tracking-[.16em] text-[var(--purple)]">
                {recipientName} · {domainName} · 结构细读
              </p>
              <h1 className="mt-2 max-w-[760px] text-[27px] font-semibold leading-10 tracking-[.04em] text-[var(--ink)] sm:text-[32px]">
                {question}
              </h1>
              <p className="mt-3 max-w-[690px] text-[13px] leading-6 text-[var(--muted)]">
                先沿着典型结构找到全部同路径证据，再比较同一位置换一种行动时原文如何改变。
              </p>
            </header>

            {mainEpisode ? (
              <>
                <section className="bg-[rgba(255,254,249,.62)] px-5 py-6 sm:px-7" aria-label="研究发现摘要">
                  <DataSummary
                    current={matches.length}
                    total={episodes.length}
                    mainPathCount={mainPathGroup.episodes.length}
                    pathCount={pathGroups.length}
                  />
                  <div className="mt-6 grid gap-5 border-t border-[var(--line)] pt-5 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
                    <div>
                      <p className="text-[11px] tracking-[.12em] text-[var(--muted)]">最高频结构</p>
                      <p className="mt-2 text-[13px] leading-6">
                        叶德辉先{ACTION_MEANINGS[selected.type]}，随后提出请求。
                      </p>
                    </div>
                    <StructureCompass episodes={mainPathGroup.episodes} selected={selected} />
                  </div>
                </section>

                <section className="pt-12" aria-labelledby="typical-paths-title">
                  <div id="typical-paths-title">
                    <SectionHeading
                      no="壹"
                      title="典型书信"
                      note={`先看三组代表结构 · 共${matches.length}个请求实例`}
                    />
                  </div>
                  <div>
                    {visibleTypicalGroups.map((group, index) => (
                      <EvidenceRow
                        episode={group.episodes[0]}
                        index={index}
                        selected={selected}
                        pathEpisodes={group.episodes}
                        pathTotal={matches.length}
                        pathOpen={openPathKey === group.key}
                        onTogglePath={() => {
                          setOpenPathKey((current) => current === group.key ? null : group.key);
                          setOpenEpisodeId(null);
                        }}
                        openEpisodeId={openEpisodeId}
                        onToggleEpisode={(id) => setOpenEpisodeId((current) => current === id ? null : id)}
                        key={group.key}
                      />
                    ))}
                  </div>
                  {pathGroups.length > 3 && (
                    <button
                      type="button"
                      className="mt-5 border-0 border-b border-[var(--ink)] bg-transparent pb-1 text-[13px] text-[var(--ink)] hover:text-[var(--purple)]"
                      onClick={() => setShowAllTypical((value) => !value)}
                    >
                      {showAllTypical ? "收起其余路径 ↑" : `查看全部 ${pathGroups.length} 种路径 ↓`}
                    </button>
                  )}
                </section>

                <section className="pt-14" aria-labelledby="counter-path-title">
                  <div id="counter-path-title">
                    <SectionHeading
                      no="贰"
                      title="同一位置，换一种行动会怎样？"
                      note={`${alternativeOptions.length}种替代行动可比较`}
                    />
                  </div>
                  {counterEpisode && pairedTypicalEpisode ? (
                    <>
                      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-3 border-b border-[var(--line)] py-5">
                        <p className="text-[11px] tracking-[.1em] text-[var(--muted)]">
                          {POSITION_META[selected.position].label}还出现
                        </p>
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                          {alternativeOptions.map((option) => {
                            const active = activeComparisonType === option.type;
                            return (
                              <button
                                type="button"
                                className={`border-0 border-b bg-transparent pb-1 text-[12px] ${
                                  active
                                    ? "border-[var(--purple)] text-[var(--purple)]"
                                    : "border-transparent text-[var(--muted)] hover:border-[var(--line-dark)] hover:text-[var(--ink)]"
                                }`}
                                aria-pressed={active}
                                onClick={() => {
                                  setComparisonType(option.type);
                                  setShowCounterSource(false);
                                }}
                                key={option.type}
                              >
                                {ACTION_LABELS[option.type]} <span className="ml-1 tabular-nums">{option.count}例</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="border-b border-[var(--line)] py-8">
                        <ComparisonTracks
                          typical={pairedTypicalEpisode}
                          alternative={counterEpisode}
                          selected={selected}
                          typicalCount={matches.length}
                          alternativeCount={counterTypeCount}
                          total={episodes.length}
                        />
                      </div>
                      <div className="grid md:grid-cols-2">
                        <div className="py-6 pr-0 md:pr-7">
                          <p className="text-[11px] tracking-[.08em] text-[var(--purple)]">
                            {selected.position < 2 ? "请求之前" : "请求之后"} · {ACTION_LABELS[selected.type]}
                          </p>
                          <p className="mt-2 text-[13px] leading-7 text-[var(--ink)]">
                            “{clippedActionText(pairedTypicalEpisode.steps[selected.position].act?.originalText, "此处没有已标注的行动原文", 92)}”
                          </p>
                          <p className="mt-5 text-[11px] tracking-[.08em] text-[var(--muted)]">请求原文</p>
                          <p className="mt-2 text-[13px] leading-7 text-[var(--ink)]">
                            “{clippedActionText(pairedTypicalEpisode.request.originalText, "请求原文未标注", 92)}”
                          </p>
                        </div>
                        <div className="border-t border-[var(--line)] py-6 md:border-l md:border-t-0 md:pl-7">
                          <p className="text-[11px] tracking-[.08em] text-[var(--muted)]">
                            {selected.position < 2 ? "请求之前" : "请求之后"} · {ACTION_LABELS[counterEpisode.steps[selected.position].type]}
                          </p>
                          <p className="mt-2 text-[13px] leading-7 text-[var(--ink)]">
                            “{clippedActionText(
                              counterEpisode.steps[selected.position].act?.originalText,
                              counterEpisode.steps[selected.position].type === "NONE" ? "此处没有出现其他已标注行动" : "行动原文未标注",
                              92,
                            )}”
                          </p>
                          <p className="mt-5 text-[11px] tracking-[.08em] text-[var(--muted)]">请求原文</p>
                          <p className="mt-2 text-[13px] leading-7 text-[var(--ink)]">
                            “{clippedActionText(counterEpisode.request.originalText, "请求原文未标注", 92)}”
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="mt-5 border-0 border-b border-[var(--ink)] bg-transparent pb-1 text-[13px] hover:text-[var(--purple)]"
                        onClick={() => setShowCounterSource((value) => !value)}
                      >
                        {showCounterSource ? "收起对照原文 ↑" : "展开对照原文 ↓"}
                      </button>
                      {showCounterSource && (
                        <div className="mt-5 bg-[rgba(255,254,249,.62)] px-5 pb-5">
                          <EpisodeLetter episode={counterEpisode} selected={selected} />
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="py-7 text-[12px] leading-7 text-[var(--muted)]">
                      当前范围内暂时没有可用于比较的对照书信。
                    </p>
                  )}
                </section>
              </>
            ) : (
              <section className="border-t border-[var(--line-dark)] py-20 text-center">
                <p className="text-[13px] text-[var(--ink)]">当前选择下没有可供细读的书信</p>
                <button
                  type="button"
                  className="mt-4 border-0 bg-transparent text-[12px] text-[var(--purple)] hover:underline"
                  onClick={() => setScreen("overview")}
                >
                  返回棋盘重新选择
                </button>
              </section>
            )}
          </article>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[var(--paper)] pb-24 font-serif">
      <div className="site-container">
        <header className="border-b border-[var(--line-dark)] py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link className="text-[11px] tracking-[.12em] text-[var(--blue)] hover:underline" href="/analysis">
              ← 返回维度分析
            </Link>
            <nav className="flex items-center gap-6 text-[12px]" aria-label="通信行动分析模式">
              <span className="border-b border-[var(--blue)] pb-1 text-[var(--blue)]" aria-current="page">结构纵览</span>
              <Link
                className="border-b border-transparent pb-1 text-[var(--muted)] hover:border-[var(--line-dark)] hover:text-[var(--ink)]"
                href="/analysis/request-findings"
              >
                研究发现
              </Link>
            </nav>
          </div>
          <p className="mt-5 text-[11px] font-semibold tracking-[.18em] text-[var(--blue)]">比较式书信细读 · 结构纵览</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[.06em] text-[var(--ink)] sm:text-[34px]">通信行动结构</h1>
          <p className="mt-2 max-w-2xl text-[12px] leading-6 text-[var(--muted)]">
            先在棋盘中发现一种写信现象，再决定是否沿着结构进入原文。
          </p>
        </header>

        <section className="pt-7" aria-labelledby="request-board-title">
          <header className="mb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <p className="text-[11px] font-semibold tracking-[.16em] text-[var(--green)]">单组分析</p>
              <h2 className="mt-1 text-[23px] font-semibold tracking-[.04em]" id="request-board-title">
                请求前后的行动分布
              </h2>
            </div>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] text-[var(--muted)]">
              <span>查看叶德辉致</span>
              <label className="sr-only" htmlFor="request-recipient">通信对象</label>
              <span className="relative inline-flex items-baseline">
                <select
                  id="request-recipient"
                  className="appearance-none border-0 border-b border-[var(--line-dark)] bg-transparent py-0.5 pl-0 pr-5 font-serif text-[14px] text-[var(--ink)] outline-none focus:border-[var(--purple)]"
                  value={recipient}
                  onChange={(event) => {
                    setRecipient(event.target.value);
                    setShowPaths(false);
                  }}
                >
                  <option value="ALL">所有人</option>
                  {recipients.map((name) => <option key={name}>{name}</option>)}
                </select>
                <span className="pointer-events-none absolute right-0 text-[11px] text-[var(--purple)]" aria-hidden="true">⌄</span>
              </span>
              <span>的</span>
              <label className="sr-only" htmlFor="request-domain">事务类型</label>
              <span className="relative inline-flex items-baseline">
                <select
                  id="request-domain"
                  className="appearance-none border-0 border-b border-[var(--line-dark)] bg-transparent py-0.5 pl-0 pr-5 font-serif text-[14px] text-[var(--ink)] outline-none focus:border-[var(--purple)]"
                  value={domain}
                  onChange={(event) => {
                    setDomain(event.target.value as EventType | "ALL");
                    setShowPaths(false);
                  }}
                >
                  {DOMAINS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                </select>
                <span className="pointer-events-none absolute right-0 text-[11px] text-[var(--purple)]" aria-hidden="true">⌄</span>
              </span>
              <span>请求结构 · {episodes.length}例</span>
            </p>
          </header>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
            <p className="text-[11px] text-[var(--muted)]">点击墨点选择现象，棋盘下方会先解释它代表什么</p>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2 text-[10px] text-[var(--muted)]" aria-label="墨色越深，出现越频繁">
                <span>少见</span>
                {[0.36, 0.55, 0.76, 1].map((opacity) => (
                  <i className="block size-2.5 rounded-full bg-[var(--blue)] not-italic" style={{ opacity }} key={opacity} />
                ))}
                <span>常见</span>
              </div>
              <button
                type="button"
                className={`border-0 border-b bg-transparent pb-0.5 text-[11px] ${
                  showPaths ? "border-[var(--green)] text-[var(--green)]" : "border-[var(--line-dark)] text-[var(--muted)]"
                }`}
                aria-pressed={showPaths}
                onClick={() => setShowPaths((value) => !value)}
              >
                {showPaths ? "隐藏常见结构" : "显示常见结构"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[780px] grid-cols-[92px_repeat(2,minmax(110px,1fr))_64px_repeat(2,minmax(110px,1fr))]">
              <div />
              {POSITIONS.slice(0, 2).map((position) => (
                <div className={`pb-3 text-center ${selected.position === position ? "text-[var(--gold)]" : ""}`} key={position}>
                  <b className="block text-[12px] font-normal">{POSITION_META[position].label} <i className="not-italic text-[var(--muted)]">{POSITION_META[position].code}</i></b>
                  <small className="mt-1 block text-[10px] text-[var(--muted)]">{POSITION_META[position].phrase}</small>
                </div>
              ))}
              <div className="relative grid place-items-center pb-3 text-[13px] text-[var(--purple)] after:absolute after:bottom-0 after:left-1/2 after:h-3 after:w-px after:bg-[var(--purple)]">
                请求
              </div>
              {POSITIONS.slice(2).map((position) => (
                <div className={`pb-3 text-center ${selected.position === position ? "text-[var(--gold)]" : ""}`} key={position}>
                  <b className="block text-[12px] font-normal">{POSITION_META[position].label} <i className="not-italic text-[var(--muted)]">{POSITION_META[position].code}</i></b>
                  <small className="mt-1 block text-[10px] text-[var(--muted)]">{POSITION_META[position].phrase}</small>
                </div>
              ))}

              {ACTION_ORDER.map((type) => (
                <div className="contents" key={type}>
                  <div className={`flex min-h-13 items-center border-t border-[var(--line)] text-[12px] ${selected.type === type ? "text-[var(--gold)]" : ""}`}>
                    {ACTION_LABELS[type]}
                  </div>
                  {POSITIONS.slice(0, 2).map((position) => {
                    const count = countCell(episodes, { position, type });
                    const active = selected.position === position && selected.type === type;
                    const ratio = count / Math.max(episodes.length, 1);
                    const opacity = ratio === 0 ? 0 : ratio <= 0.1 ? 0.36 : ratio <= 0.25 ? 0.55 : ratio <= 0.45 ? 0.76 : 1;
                    return (
                      <button
                        type="button"
                        className={`grid min-h-13 place-items-center border-0 border-t border-[var(--line)] bg-transparent transition hover:bg-[rgba(255,254,249,.72)] focus-visible:outline-1 focus-visible:outline-[var(--gold)] ${active ? "bg-[rgba(154,124,69,.07)]" : ""}`}
                        aria-pressed={active}
                        aria-label={`${ACTION_LABELS[type]}，${POSITION_META[position].label}，${count}例，占${pct(count, episodes.length)}`}
                        key={position}
                        onMouseEnter={(event) => {
                          if (count) previewCell(event.currentTarget, { position, type });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                        onFocus={(event) => {
                          if (count) previewCell(event.currentTarget, { position, type });
                        }}
                        onBlur={() => setHoveredPoint(null)}
                        onClick={() => chooseCell({ position, type })}
                      >
                        <span className={`relative grid size-7 place-items-center ${active ? "after:absolute after:inset-0 after:rounded-full after:border after:border-[var(--gold)]" : ""}`}>
                          {count ? <i className="block size-3 rounded-full bg-[var(--blue)] not-italic" style={{ opacity }} /> : null}
                        </span>
                      </button>
                    );
                  })}
                  <div className="relative min-h-13 border-t border-[var(--line)] after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-[var(--line-dark)]" />
                  {POSITIONS.slice(2).map((position) => {
                    const count = countCell(episodes, { position, type });
                    const active = selected.position === position && selected.type === type;
                    const ratio = count / Math.max(episodes.length, 1);
                    const opacity = ratio === 0 ? 0 : ratio <= 0.1 ? 0.36 : ratio <= 0.25 ? 0.55 : ratio <= 0.45 ? 0.76 : 1;
                    return (
                      <button
                        type="button"
                        className={`grid min-h-13 place-items-center border-0 border-t border-[var(--line)] bg-transparent transition hover:bg-[rgba(255,254,249,.72)] focus-visible:outline-1 focus-visible:outline-[var(--gold)] ${active ? "bg-[rgba(154,124,69,.07)]" : ""}`}
                        aria-pressed={active}
                        aria-label={`${ACTION_LABELS[type]}，${POSITION_META[position].label}，${count}例，占${pct(count, episodes.length)}`}
                        key={position}
                        onMouseEnter={(event) => {
                          if (count) previewCell(event.currentTarget, { position, type });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                        onFocus={(event) => {
                          if (count) previewCell(event.currentTarget, { position, type });
                        }}
                        onBlur={() => setHoveredPoint(null)}
                        onClick={() => chooseCell({ position, type })}
                      >
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

          {hoveredPoint && (() => {
            const hoverCount = countCell(episodes, hoveredPoint.cell);
            const baselineCount = countCell(comparisonEpisodes, hoveredPoint.cell);
            const hoverShare = hoverCount / Math.max(episodes.length, 1);
            const baselineShare = baselineCount / Math.max(comparisonEpisodes.length, 1);
            const hoverDelta = Math.round((hoverShare - baselineShare) * 100);
            return (
              <div
                className="pointer-events-none fixed z-50 w-[230px] -translate-x-1/2 -translate-y-full bg-[var(--paper)] px-4 py-3 shadow-[0_12px_32px_rgba(34,31,27,.16)] outline outline-1 outline-[var(--line-dark)]"
                style={{ left: hoveredPoint.x, top: hoveredPoint.y }}
                role="tooltip"
              >
                <p className="text-[11px] tracking-[.1em] text-[var(--blue)]">
                  {POSITION_META[hoveredPoint.cell.position].label} · {ACTION_LABELS[hoveredPoint.cell.type]}
                </p>
                <p className="mt-2 text-[18px] tabular-nums text-[var(--ink)]">
                  {hoverCount}<span className="mx-1 text-[12px] text-[var(--muted)]">/</span>{episodes.length}
                  <span className="ml-3 text-[12px] text-[var(--gold)]">{pct(hoverCount, episodes.length)}</span>
                </p>
                <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">
                  总体基线 {pct(baselineCount, comparisonEpisodes.length)}
                  {hoverDelta !== 0 && ` · 当前${hoverDelta > 0 ? "高" : "低"}${Math.abs(hoverDelta)}个百分点`}
                </p>
                <p className="mt-2 text-[9px] text-[var(--muted)]">点击固定这一观察</p>
              </div>
            );
          })()}

          {showPaths && (
            <section className="mt-7 border-y border-[var(--line)] py-5" aria-label="当前选择的常见完整结构">
              <div className="grid gap-5 md:grid-cols-[150px_minmax(0,1fr)]">
                <div>
                  <p className="text-[11px] tracking-[.12em] text-[var(--muted)]">常见结构</p>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--ink)]">用位置罗盘展示三种常见写法</p>
                </div>
                <div className="space-y-4">
                  {pathGroups.slice(0, 3).map((group, index) => (
                    <div className="grid grid-cols-[20px_minmax(0,1fr)_70px] items-center gap-3 border-b border-[var(--line)] pb-3" key={group.key}>
                      <span className="text-[10px] text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span>
                      <StructureCompass episodes={group.episodes} selected={selected} compact />
                      <span className="text-right text-[10px] leading-4 text-[var(--muted)]">
                        {group.episodes.length}例<br />{pct(group.episodes.length, matches.length)}
                      </span>
                    </div>
                  ))}
                  {!pathGroups.length && <p className="text-[12px] text-[var(--muted)]">当前选择下没有完整路径</p>}
                </div>
              </div>
            </section>
          )}

          <section className="mt-6 border-y border-[var(--line-dark)] py-4" aria-labelledby="selected-phenomenon-title">
            <div className="grid items-center gap-6 lg:grid-cols-[210px_minmax(320px,1fr)_auto]">
              <div>
                <p className="text-[10px] tracking-[.12em] text-[var(--gold)]">已选择</p>
                <h3 className="mt-1 text-[16px] font-normal" id="selected-phenomenon-title">
                  {POSITION_META[selected.position].label} · {ACTION_LABELS[selected.type]}
                </h3>
                <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
                  {POSITION_META[selected.position].phrase}用于{ACTION_MEANINGS[selected.type]}。
                </p>
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[10px] tracking-[.12em] text-[var(--muted)]">最常见完整结构</p>
                  {mainPathGroup && (
                    <p className="text-[10px] tabular-nums text-[var(--muted)]">
                      同路径 {mainPathGroup.episodes.length}/{matches.length}例 · {pct(mainPathGroup.episodes.length, matches.length)}
                    </p>
                  )}
                </div>
                {mainPathGroup ? (
                  <>
                    <StructureStrip episodes={mainPathGroup.episodes} selected={selected} compact />
                    <p className="mt-2 text-[9px] tracking-[.06em] text-[var(--muted)]">区块宽度表示各行动的平均原文字数</p>
                  </>
                ) : (
                  <p className="py-5 text-[11px] text-[var(--muted)]">当前选择下没有完整结构</p>
                )}
              </div>

              <div className="space-y-4 lg:text-right">
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[11px] text-[var(--muted)] lg:justify-end">
                  <span>
                    当前 <b className="ml-1 text-[15px] font-normal tabular-nums text-[var(--ink)]">{matches.length}/{episodes.length}</b>
                    <i className="ml-1 text-[var(--gold)] not-italic">{pct(matches.length, episodes.length)}</i>
                  </span>
                  <span>
                    总体 {pct(comparisonMatches.length, comparisonEpisodes.length)}
                    {deltaPoints !== 0 && (
                      <i className="ml-1 text-[var(--gold)] not-italic">
                        · 当前{deltaPoints > 0 ? "高" : "低"}{Math.abs(deltaPoints)}个百分点
                      </i>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:justify-end">
                  <button
                    type="button"
                    className="border-0 border-b border-[var(--line-dark)] bg-transparent pb-1 text-[11px] text-[var(--muted)] hover:border-[var(--purple)] hover:text-[var(--purple)]"
                    onClick={() => setShowOverviewTable((value) => !value)}
                  >
                    {showOverviewTable ? "收起数据表 ↑" : "查看数据表 ↓"}
                  </button>
                  {mainEpisode && (
                    <button
                      type="button"
                      className="border-0 border-b border-[var(--ink)] bg-transparent pb-1 text-[13px] text-[var(--ink)] hover:border-[var(--purple)] hover:text-[var(--purple)]"
                      onClick={enterReading}
                    >
                      进入书信细读 →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {showOverviewTable && pathGroups.length > 0 && (
              <div className="mt-7 overflow-x-auto border-t border-[var(--line-dark)] pt-5">
                <table className="w-full min-w-[680px] border-collapse text-left">
                  <caption className="pb-4 text-left text-[11px] tracking-[.1em] text-[var(--muted)]">
                    当前筛选结果的完整行动结构透视表
                  </caption>
                  <thead>
                    <tr className="border-b border-[var(--ink)] text-[10px] tracking-[.08em] text-[var(--muted)]">
                      <th className="py-2 pr-4 font-normal">完整结构</th>
                      <th className="px-3 py-2 text-right font-normal">事例数</th>
                      <th className="px-3 py-2 text-right font-normal">占符合事例</th>
                      <th className="px-3 py-2 text-right font-normal">占全部请求</th>
                      <th className="py-2 pl-4 font-normal">代表书信</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pathGroups.map((group) => (
                      <tr className="border-b border-[var(--line)] text-[12px] text-[var(--ink)]" key={group.key}>
                        <td className="py-3 pr-4">{pathLabel(group.episodes[0])}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{group.episodes.length}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{pct(group.episodes.length, matches.length)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{pct(group.episodes.length, episodes.length)}</td>
                        <td className="py-3 pl-4 text-[var(--muted)]">
                          {group.episodes.slice(0, 3).map((episode) => `第${episode.letter.number}通`).join("、")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
