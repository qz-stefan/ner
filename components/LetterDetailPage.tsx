"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { actTypeMeta } from "@/lib/config";
import { formatLetterDate, getLetter, normalizeActAnnotation, normalizeEventAnnotation, searchScopeLabels } from "@/lib/data-adapter";
import type { ActMention, ActType, EventMention, Letter, SearchScope } from "@/lib/types";
import { AnnotatedLetterText } from "./AnnotatedLetterText";
import { HighlightedText } from "./HighlightedText";

interface BehaviorBlock {
  start: number;
  end: number;
  text: string;
  act: ActMention | null;
}

/** Generate a functional annotation describing the rhetorical purpose of the text. */
function getActAnnotation(act: ActMention, _eventMap: Map<string, EventMention>): string {
  const text = (act.originalText ?? "").trim();
  const t = act.type;

  // ── MNT 维系 ──
  if (t === "MNT") {
    if (/此颂|即颂|此请|顺颂|敬请|并颂|肃颂|此致|祗颂|手颂/.test(text)) return "书信结尾问候语";
    if (/此叩|叩颂|敬请钧安|虔请/.test(text)) return "书信结尾敬语";
    if (/甚念|驰念|悬悬|甚慰|为慰|至以为慰/.test(text)) return "表达挂念与慰问";
    if (/旬日未晤|久未通问|久疏|久未晤|久不/.test(text)) return "表达久未联系的歉意";
    if (/别后|别经|经年|岁更/.test(text)) return "叙别后之情";
    return "维系关系，表达问候";
  }

  // ── INF 告知 ──
  if (t === "INF") {
    if (/近状|近况|起居|万安|安好|康健/.test(text)) return "转达近况问候";
    if (/闻|听闻|得悉|获悉|顷闻|近闻/.test(text)) return "转述听闻之事";
    if (/书|函|信|札|寄|惠书/.test(text) && /收到|收悉|接|奉|得/.test(text)) return "告知来信收悉";
    if (/已|业已|已经|均已|均已办/.test(text)) return "告知事项进展";
    if (/到|抵|行踪|在|寓|住/.test(text)) return "告知行踪住处";
    return "告知近况与信息";
  }

  // ── REQ 请求 ──
  if (t === "REQ") {
    if (/可否|能否|能.*否|乞|恳|请|托|烦|求|望/.test(text)) return "提出请求或委托";
    if (/何不|不如|宜|应|当/.test(text)) return "提出建议";
    return "向对方提出请求";
  }

  // ── DSP 展示 ──
  if (t === "DSP") {
    if (/碑|帖|书|画|拓|刻|版本|金石/.test(text)) return "展示金石碑帖之见解";
    if (/诗|词|文|赋|联|楹/.test(text)) return "展示诗文创作与品评";
    if (/考|证|辨|校|勘|版本/.test(text)) return "展示版本考证之学";
    return "展示学识与见解";
  }

  // ── PRS 赞扬 ──
  if (t === "PRS") {
    if (/佳|妙|好|精|善|美/.test(text)) return "表达赞许与欣赏";
    if (/钦佩|佩服|敬仰|仰慕|推崇/.test(text)) return "表达钦佩仰慕之情";
    return "表达赞扬与肯定";
  }

  // ── INS 训导 ──
  if (t === "INS") {
    if (/宜|应|当|须|不可|毋|勿|戒/.test(text)) return "提出规劝与教诲";
    return "进行学术指导与训诫";
  }

  // ── NEG 协商 ──
  if (t === "NEG") {
    if (/可否|能否|商量|商议|酌|裁|定夺/.test(text)) return "商议事务安排";
    return "协商讨论具体事项";
  }

  const fallback: Record<string, string> = { MNT: "维系关系", INF: "传递信息", REQ: "提出请求", DSP: "展示", PRS: "表达赞扬", INS: "提出训导", NEG: "协商讨论" }; return fallback[t] ?? t;
}

/**
 * Split letter text into behavior blocks at ACT boundaries.
 * Adjacent acts of the same type are merged into a single block to avoid
 * excessive fragmentation.
 */
function splitIntoBehaviorBlocks(text: string, acts: ActMention[]): BehaviorBlock[] {
  const sorted = [...acts].sort((a, b) => a.start - b.start);
  if (!sorted.length) return [];

  // Phase 1: merge adjacent same-type acts
  const merged: ActMention[] = [];
  for (const act of sorted) {
    if (act.start >= act.end) continue;
    const prev = merged[merged.length - 1];
    if (prev && prev.type === act.type && act.start <= prev.end) {
      // Merge into previous: extend end, join text
      const extended: ActMention = {
        ...prev,
        end: Math.max(prev.end, act.end),
        originalText: (prev.originalText + act.originalText).replace(/\s+/g, " ").trim(),
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

  // Build event map for act → paraphrase lookup
  const eventMap = useMemo(() => {
    if (!letter) return new Map<string, EventMention>();
    const events = normalizeEventAnnotation(letter.id);
    return new Map(events.map((ev) => [ev.id, ev]));
  }, [letter]);

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
      <div className="detail-controls">
        {(["entity", "event"] as const).map((layer) => <button type="button" key={layer} className={layers[layer] ? "selected" : ""} aria-pressed={layers[layer]} onClick={() => setLayers((c) => ({ ...c, [layer]: !c[layer] }))}>{layer === "entity" ? "第一层标注" : "第二层标注"} {layers[layer] ? "✓" : ""}</button>)}
        <button type="button" className={layers.act ? "selected" : ""} aria-pressed={layers.act} onClick={() => setLayers((c) => ({ ...c, act: !c.act }))}>第三层标注 {layers.act ? "✓" : ""}</button>
      </div>

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
              {block.act ? (
                <div className="behavior-annotation">
                  <span className="behavior-type">{actTypeMeta[block.act.type]?.label ?? block.act.type}：</span>
                  <span className="behavior-description">{getActAnnotation(block.act, eventMap)}</span>
                </div>
              ) : null}
            </div>
          ))}
        </article>
      ) : (
        /* ── Continuous text (act OFF) ── */
        <article className="detail-original-only"><AnnotatedLetterText letter={letter as Letter} showEntity={layers.entity} showEvent={layers.event} searchMatch={searchMatch} /></article>
      )}

      <footer className="letter-record"><div><span>收信人</span><p>{scope === "recipient" && query ? <HighlightedText text={letter.recipient} query={query} /> : letter.recipient}</p></div><div><span>时间</span><p>{formatLetterDate(letter)}</p></div><div><span>来源</span><p>{scope === "source" && query ? <HighlightedText text={letter.source ?? "暂无来源字段"} query={query} markId="search-match" /> : letter.source ?? "暂无来源字段"}</p></div></footer>
    </main>
  );
}
