"use client";

import Link from "next/link";
import { useState } from "react";
import { actTypeMeta } from "@/lib/config";
import { formatLetterDate, getFeaturedLetters, normalizeActAnnotation } from "@/lib/data-adapter";
import type { ActMention, ActType } from "@/lib/types";
import { AnnotatedLetterText } from "./AnnotatedLetterText";

// ── Behavior block types ──

interface BehaviorBlock {
  start: number;
  end: number;
  text: string;
  act: ActMention | null;
}

/** Generate a functional annotation describing the rhetorical purpose of the text. */
function getActDescription(act: ActMention): string {
  const text = (act.originalText ?? "").trim();
  const t = act.type;

  if (t === "MNT") {
    if (/此颂|即颂|此请|顺颂|敬请|并颂|肃颂|此致|祗颂|手颂/.test(text)) return "书信结尾问候语";
    if (/此叩|叩颂|敬请钧安|虔请/.test(text)) return "书信结尾敬语";
    if (/甚念|驰念|悬悬|甚慰|为慰|至以为慰/.test(text)) return "表达挂念与慰问";
    if (/旬日未晤|久未通问|久疏|久未晤|久不/.test(text)) return "表达久未联系的歉意";
    if (/别后|别经|经年|岁更/.test(text)) return "叙别后之情";
    return "维系关系，表达问候";
  }
  if (t === "INF") {
    if (/近状|近况|起居|万安|安好|康健/.test(text)) return "转达近况问候";
    if (/闻|听闻|得悉|获悉|顷闻|近闻/.test(text)) return "转述听闻之事";
    if (/书|函|信|札|寄|惠书/.test(text) && /收到|收悉|接|奉|得/.test(text)) return "告知来信收悉";
    if (/已|业已|已经|均已|均已办/.test(text)) return "告知事项进展";
    if (/到|抵|行踪|在|寓|住/.test(text)) return "告知行踪住处";
    return "告知近况与信息";
  }
  if (t === "REQ") {
    if (/可否|能否|能.*否|乞|恳|请|托|烦|求|望/.test(text)) return "提出请求或委托";
    if (/何不|不如|宜|应|当/.test(text)) return "提出建议";
    return "向对方提出请求";
  }
  if (t === "DSP") {
    if (/碑|帖|书|画|拓|刻|版本|金石/.test(text)) return "展示金石碑帖之见解";
    if (/诗|词|文|赋|联|楹/.test(text)) return "展示诗文创作与品评";
    if (/考|证|辨|校|勘|版本/.test(text)) return "展示版本考证之学";
    return "展示学识与见解";
  }
  if (t === "PRS") {
    if (/佳|妙|好|精|善|美/.test(text)) return "表达赞许与欣赏";
    if (/钦佩|佩服|敬仰|仰慕|推崇/.test(text)) return "表达钦佩仰慕之情";
    return "表达赞扬与肯定";
  }
  if (t === "INS") {
    if (/宜|应|当|须|不可|毋|勿|戒/.test(text)) return "提出规劝与教诲";
    return "进行学术指导与训诫";
  }
  if (t === "NEG") {
    if (/可否|能否|商量|商议|酌|裁|定夺/.test(text)) return "商议事务安排";
    return "协商讨论具体事项";
  }
  const fallback: Record<string, string> = { MNT: "维系关系", INF: "传递信息", REQ: "提出请求", DSP: "展示", PRS: "表达赞扬", INS: "提出训导", NEG: "协商讨论" }; return fallback[t] ?? t;
}

/**
 * Split text into behavior blocks, merging adjacent same-type acts
 * so that semantic units stay together instead of fragmenting.
 */
function buildBehaviorBlocks(text: string, acts: ActMention[]): BehaviorBlock[] {
  const sorted = [...acts].sort((a, b) => a.start - b.start);
  if (!sorted.length) return [];

  // Phase 1: merge adjacent same-type acts
  const merged: ActMention[] = [];
  for (const act of sorted) {
    if (act.start >= act.end) continue;
    const prev = merged[merged.length - 1];
    if (prev && prev.type === act.type && act.start <= prev.end) {
      merged[merged.length - 1] = {
        ...prev,
        end: Math.max(prev.end, act.end),
        originalText: (prev.originalText + act.originalText).replace(/\s+/g, " ").trim(),
      };
    } else {
      merged.push({ ...act });
    }
  }

  // Phase 2: build blocks
  const blocks: BehaviorBlock[] = [];
  let cursor = 0;
  for (const act of merged) {
    if (act.start < cursor) continue;
    if (act.start > cursor) {
      const plain = text.slice(cursor, act.start);
      if (plain.trim()) blocks.push({ start: cursor, end: act.start, text: plain, act: null });
    }
    blocks.push({ start: act.start, end: act.end, text: text.slice(act.start, act.end), act });
    cursor = act.end;
  }
  if (cursor < text.length) {
    const tail = text.slice(cursor);
    if (tail.trim()) blocks.push({ start: cursor, end: text.length, text: tail, act: null });
  }
  return blocks;
}

// ── Component ──

export function FeaturedLetterViewer() {
  const letters = getFeaturedLetters();
  const [index, setIndex] = useState(0);
  // Three independent layer states — Layer 3 defaults OFF
  const [showLayer1, setShowLayer1] = useState(true);
  const [showLayer2, setShowLayer2] = useState(false);
  const [showLayer3, setShowLayer3] = useState(false);
  const letter = letters[index];

  if (!letter) return <p>暂无优秀示例配置。</p>;

  const allActs: ActMention[] = showLayer3
    ? normalizeActAnnotation(letter.id).sort((a, b) => a.start - b.start)
    : [];
  const blocks = showLayer3 ? buildBehaviorBlocks(letter.text, allActs) : [];
  const hasActData = allActs.length > 0;

  function hideAll() {
    setShowLayer1(false);
    setShowLayer2(false);
    setShowLayer3(false);
  }

  return (
    <section className="featured-viewer" aria-labelledby="featured-title">
      <div className="viewer-heading">
        <div><span>FEATURED ANNOTATION</span><h1 id="featured-title">优秀标注示例</h1></div>
        <div className="letter-switcher" aria-label="切换优秀示例">
          <button type="button" onClick={() => setIndex((index - 1 + letters.length) % letters.length)} aria-label="上一封">←</button>
          <b>{String(index + 1).padStart(2, "0")} <i>/</i> {String(letters.length).padStart(2, "0")}</b>
          <button type="button" onClick={() => setIndex((index + 1) % letters.length)} aria-label="下一封">→</button>
        </div>
      </div>

      <div className="annotation-controls" aria-label="标注显示控制">
        <span>标注显示</span>
        <button type="button" aria-pressed={showLayer1} className={showLayer1 ? "selected" : ""} onClick={() => setShowLayer1((v) => !v)}>
          <i className="control-dot entity-dot" /> 第一层标注 {showLayer1 ? "✓" : ""}
        </button>
        <button type="button" aria-pressed={showLayer2} className={showLayer2 ? "selected" : ""} onClick={() => setShowLayer2((v) => !v)}>
          <i className="control-dot event-dot" /> 第二层标注 {showLayer2 ? "✓" : ""}
        </button>
        <button type="button" aria-pressed={showLayer3} className={showLayer3 ? "selected" : ""} onClick={() => setShowLayer3((v) => !v)}>
          <i className="control-dot act-dot" /> 第三层行为 {showLayer3 ? "✓" : ""}
        </button>
        <button className="hide-all" type="button" onClick={hideAll}>隐藏全部</button>
      </div>

      <article className="letter-reading">
        <header className="letter-heading">
          <span className="letter-id">书信 {letter.number}</span>
          <h2>致{letter.recipient}</h2>
          <time>{formatLetterDate(letter)}</time>
        </header>

        {/* ── Behavior block view (layer 3 ON) ── */}
        {showLayer3 ? (
          hasActData ? (
            <div className="behavior-block-view">
              {blocks.map((block, i) => (
                <div key={i} className={`behavior-block${block.act ? " has-act" : ""}`}>
                  <div className="behavior-text">
                    <AnnotatedLetterText
                      letter={letter}
                      showEntity={showLayer1}
                      showEvent={showLayer2}
                      rangeStart={block.start}
                      rangeEnd={block.end}
                    />
                  </div>
                  {block.act ? (
                    <div className="behavior-annotation">
                      <span className="behavior-type">{actTypeMeta[block.act.type]?.label ?? block.act.type}：</span>
                      <span className="behavior-description">{getActDescription(block.act)}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <>
              <AnnotatedLetterText letter={letter} showEntity={showLayer1} showEvent={showLayer2} />
              <p className="behavior-empty-hint">该书信暂未添加行为标注</p>
            </>
          )
        ) : (
          /* ── Continuous text (layer 3 OFF) ── */
          <AnnotatedLetterText letter={letter} showEntity={showLayer1} showEvent={showLayer2} />
        )}

        <footer className="source-citation">
          <span>来源</span><p>{letter.source ?? "暂无来源字段"}</p>
          <Link className="letter-detail-link" href={`/letter/${encodeURIComponent(letter.id)}`}>查看完整书信信息 <i aria-hidden="true">→</i></Link>
        </footer>
      </article>
    </section>
  );
}
