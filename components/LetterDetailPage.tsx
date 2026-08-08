"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { actTypeMeta } from "@/lib/config";
import { formatLetterDate, getLetter, normalizeActAnnotation, searchScopeLabels } from "@/lib/data-adapter";
import type { ActMention, Letter, SearchScope } from "@/lib/types";
import { AnnotatedLetterText } from "./AnnotatedLetterText";
import { HighlightedText } from "./HighlightedText";
import { LetterAnnotationIndex } from "./LetterAnnotationIndex";

interface BehaviorBlock {
  start: number;
  end: number;
  text: string;
  act: ActMention | null;
}

/** Map contentDomainEvidence to domain tags. */
const DOMAIN_PATTERNS: [RegExp, string][] = [
  [/人际|通信|会晤|邀约|赠答|往还/g, "人际"],
  [/书籍|著述|校勘|刊刻|文献流通|文献/g, "文献"],
  [/经学|学派|学术判断|学术/g, "学术"],
  [/政治|制度|时局|公共事务|时政/g, "时政"],
  [/亲属|先祖|祭祖|家族|邦族/g, "家族"],
  [/遗憾|哀悼|欣慰|感谢|歉意|惋惜/g, "情感"],
];

function extractDomains(evidence: string | null | undefined): string[] {
  if (!evidence) return [];
  const tags = new Set<string>();
  for (const [re, tag] of DOMAIN_PATTERNS) {
    if (re.test(evidence)) tags.add(tag);
    re.lastIndex = 0;
  }
  return [...tags].slice(0, 2);
}

/**
 * Generate a natural, human-readable description of what the act IS DOING.
 * Combines the rhetorical subtype with the content domain to produce
 * descriptions like "告知近况", "请求书籍帮助", "论证学术观点", etc.
 */
function describeAction(subtype: string | null | undefined, domains: string[]): string {
  const templates: Record<string, Record<string, string>> = {
    告知: {
      人际: "告知个人近况与日常往来",
      文献: "告知书籍文献相关信息",
      学术: "告知学术研究与学问进展",
      时政: "告知时局政事近闻",
      家族: "告知家族事务近况",
      _: "告知事项近况",
    },
    论证: {
      人际: "议论人事往来与交游",
      文献: "论证文献真伪与版本源流",
      学术: "论证学术观点与学问见解",
      时政: "议论时局政事与形势",
      家族: "议论家族事务与家世",
      _: "论证观点见解",
    },
    评价: {
      人际: "评价人物品性与人事",
      文献: "评价文献价值与版本优劣",
      学术: "评价学术贡献与学问造诣",
      时政: "评价时局政事与形势",
      家族: "评价家族事务与家世",
      _: "发表评价看法",
    },
    请求: {
      人际: "请求对方帮忙办事或引介",
      文献: "请求寄送、代寻或提供书籍文献",
      学术: "请求学术方面的帮助与指教",
      时政: "请求政事方面的帮助",
      家族: "请求家族事务方面的帮助",
      _: "请求对方帮助",
    },
    询问: {
      人际: "打听近况与人事消息",
      文献: "询问书籍文献的相关信息",
      学术: "询问学术问题与学问意见",
      时政: "询问时局政事近闻",
      家族: "询问家族事务近况",
      _: "询问打听信息",
    },
    建议: {
      人际: "就人事往来提出建议",
      文献: "就文献事务提出建议",
      学术: "就学术方向与学问提出建议",
      时政: "就时局政事提出建议",
      家族: "就家族事务提出建议",
      _: "提出建议",
    },
    承诺: {
      人际: "承诺后续人事往来与交往",
      文献: "承诺处理书籍文献事务",
      学术: "承诺学术方面的事务",
      时政: "承诺政事方面的事务",
      家族: "承诺家族方面的事务",
      _: "承诺后续行动",
    },
    提供: {
      人际: "提供人际方面的帮助",
      文献: "提供或寄送书籍文献",
      学术: "提供学术资源与帮助",
      时政: "提供政事方面的协助",
      家族: "提供家族事务协助",
      _: "提供帮助",
    },
    祝颂: { _: "表达祝颂与敬意" },
    问候: { _: "问候对方近况起居" },
    感谢: { _: "表达感谢之情" },
    致歉: { _: "表达歉意与不安" },
    庆贺: { _: "表达庆贺之意" },
  };

  const t = subtype ?? "";
  const map = templates[t];
  if (!map) {
    const d = domains[0];
    return d ? `${t}${d}` : t;
  }
  for (const d of domains) {
    if (map[d]) return map[d];
  }
  return map._ ?? t;
}

function getActTypeLabel(act: ActMention): string {
  const label = actTypeMeta[act.type]?.label ?? act.type;
  return act.subtype ? `${label} · ${act.subtype}` : label;
}

function getActExplanation(act: ActMention): string {
  const domains = extractDomains(act.contentDomainEvidence);
  // For merged acts, use the first subtype for the description
  const primarySubtype = act.subtype?.split("·")[0] ?? null;
  return describeAction(primarySubtype, domains);
}

/**
 * Split letter text into behavior blocks at ACT boundaries.
 * Adjacent acts of the same type are merged into a single block to avoid
 * excessive fragmentation.
 */
function splitIntoBehaviorBlocks(text: string, acts: ActMention[]): BehaviorBlock[] {
  const sorted = [...acts].sort((a, b) => a.start - b.start);
  if (!sorted.length) return [];

  // Phase 1: merge adjacent acts of the same type AND subtype
  const merged: ActMention[] = [];
  for (const act of sorted) {
    if (act.start >= act.end) continue;
    const prev = merged[merged.length - 1];
    if (prev && prev.type === act.type && (prev.subtype ?? null) === (act.subtype ?? null) && act.start <= prev.end) {
      const extended: ActMention = {
        ...prev,
        end: Math.max(prev.end, act.end),
        originalText: text.slice(prev.start, Math.max(prev.end, act.end)).replace(/\s+/g, " ").trim(),
      };
      merged[merged.length - 1] = extended;
    } else {
      merged.push({ ...act });
    }
  }

  // Phase 2: build blocks with plain-text gaps
  const blocks: BehaviorBlock[] = [];
  let cursor = 0;

  for (const act of merged) {
    if (act.start < cursor) continue;

    if (act.start > cursor) {
      const plain = text.slice(cursor, act.start);
      if (plain.trim()) {
        blocks.push({ start: cursor, end: act.start, text: plain, act: null });
      }
    }

    blocks.push({
      start: act.start,
      end: act.end,
      text: text.slice(act.start, act.end),
      act,
    });
    cursor = act.end;
  }

  if (cursor < text.length) {
    const tail = text.slice(cursor);
    if (tail.trim()) {
      blocks.push({ start: cursor, end: text.length, text: tail, act: null });
    }
  }

  return blocks;
}

export function LetterDetailPage({ id, query = "", scope = "fulltext", matchStart }: { id: string; query?: string; scope?: SearchScope; matchStart?: number }) {
  const letter = getLetter(id);
  const [layers, setLayers] = useState({ entity: true, event: false, act: false });

  const fallbackMatch = letter && query ? letter.text.toLocaleLowerCase("zh-CN").indexOf(query.toLocaleLowerCase("zh-CN")) : -1;
  const textMatchStart = scope === "fulltext" ? (typeof matchStart === "number" && matchStart >= 0 ? matchStart : fallbackMatch) : -1;
  const searchMatch = textMatchStart >= 0 ? { start: textMatchStart, length: query.length } : null;

  useEffect(() => {
    if (!query) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById("search-match")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
    return () => cancelAnimationFrame(frame);
  }, [id, query, scope, textMatchStart]);

  if (!letter) return <main className="site-container page-state">未找到书信 {id}。</main>;

  const allActs: ActMention[] = normalizeActAnnotation(letter.id).sort((a, b) => a.start - b.start);
  const behaviorBlocks = splitIntoBehaviorBlocks(letter.text, allActs);

  return (
    <main className="letter-detail-page site-container">
      <Link className="back-link" href="/letters">← 返回书信检索</Link>
      <header className="letter-detail-heading"><span>LETTER {letter.number}</span><h1>致{scope === "recipient" && query ? <HighlightedText text={letter.recipient} query={query} markId="search-match" /> : letter.recipient}</h1><time>{formatLetterDate(letter)}</time></header>
      {query ? <p className="detail-match-note">由&ldquo;{searchScopeLabels[scope]}&rdquo;检索进入，已定位并标出&ldquo;{query}&rdquo;。</p> : null}
      <LetterAnnotationIndex letterId={letter.id} layers={layers} onLayersChange={setLayers}>
        {/* ── Behavior block mode (act layer ON) ── */}
        {layers.act ? (
          <article className="behavior-block-view">
            {behaviorBlocks.map((block, i) => (
              <div key={i} className={`behavior-block${block.act ? " has-act" : ""}`}>
                <div className="behavior-text">
                  <AnnotatedLetterText
                    letter={letter as Letter}
                    showEntity={layers.entity}
                    showEvent={layers.event}
                    rangeStart={block.start}
                    rangeEnd={block.end}
                    searchMatch={searchMatch}
                  />
                </div>
                {block.act ? (() => {
                  const expl = getActExplanation(block.act);
                  return (
                    <div className="behavior-annotation">
                      <span className="behavior-type">{getActTypeLabel(block.act)}{expl ? "：" : ""}</span>
                      {expl ? <span className="behavior-description">{expl}</span> : null}
                    </div>
                  );
                })() : null}
              </div>
            ))}
          </article>
        ) : (
          /* ── Continuous text (act OFF) ── */
          <article className="detail-original-only"><AnnotatedLetterText letter={letter as Letter} showEntity={layers.entity} showEvent={layers.event} searchMatch={searchMatch} /></article>
        )}
      </LetterAnnotationIndex>

      <footer className="letter-record"><div><span>收信人</span><p>{scope === "recipient" && query ? <HighlightedText text={letter.recipient} query={query} /> : letter.recipient}</p></div><div><span>时间</span><p>{formatLetterDate(letter)}</p></div><div><span>来源</span><p>{scope === "source" && query ? <HighlightedText text={letter.source ?? "暂无来源字段"} query={query} markId="search-match" /> : letter.source ?? "暂无来源字段"}</p></div></footer>
    </main>
  );
}
