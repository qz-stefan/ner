"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useState } from "react";
import { actTypeMeta } from "@/lib/config";
import { formatLetterDate, getFeaturedLetters, normalizeActAnnotation } from "@/lib/data-adapter";
import type { ActMention } from "@/lib/types";
import { AnnotatedLetterText } from "./AnnotatedLetterText";
import { LetterAnnotationIndex } from "./LetterAnnotationIndex";

// ── Helpers ──

/** Merge adjacent acts with the same type AND subtype. */
function mergeAdjacentSame(acts: ActMention[], letterText: string): ActMention[] {
  if (!acts.length) return [];
  const merged: ActMention[] = [];
  for (const act of acts) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === act.type && (prev.subtype ?? null) === (act.subtype ?? null)) {
      merged[merged.length - 1] = {
        ...prev,
        end: act.end,
        originalText: letterText.slice(prev.start, act.end),
      };
    } else {
      merged.push({ ...act });
    }
  }
  return merged;
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

// ── Component ──

export function FeaturedLetterViewer() {
  const letters = getFeaturedLetters();
  const [index, setIndex] = useState(0);
  const [showLayer1, setShowLayer1] = useState(true);
  const [showLayer2, setShowLayer2] = useState(false);
  const [showLayer3, setShowLayer3] = useState(false);
  const letter = letters[index] ?? null;

  const allActs: ActMention[] = useMemo(
    () => (showLayer3 && letter ? normalizeActAnnotation(letter.id).sort((a, b) => a.start - b.start) : []),
    [letter, showLayer3],
  );
  const hasActData = allActs.length > 0;

  const mergedActs = useMemo(
    () => (showLayer3 && letter ? mergeAdjacentSame(allActs, letter.text) : []),
    [allActs, letter, showLayer3],
  );

  if (!letter) return <p>暂无优秀示例配置。</p>;

  return (
    <section className="featured-viewer" aria-labelledby="featured-title">
      <div className="viewer-heading">
        <h2 className="sr-only" id="featured-title">阅读标注书信</h2>
        <div className="letter-switcher" aria-label="切换优秀示例">
          <button type="button" onClick={() => setIndex((index - 1 + letters.length) % letters.length)} aria-label="上一封">←</button>
          <b>{String(index + 1).padStart(2, "0")} <i>/</i> {String(letters.length).padStart(2, "0")}</b>
          <button type="button" onClick={() => setIndex((index + 1) % letters.length)} aria-label="下一封">→</button>
        </div>
      </div>

      <LetterAnnotationIndex
        letterId={letter.id}
        layers={{ entity: showLayer1, event: showLayer2, act: showLayer3 }}
        onLayersChange={(next) => {
          setShowLayer1(next.entity);
          setShowLayer2(next.event);
          setShowLayer3(next.act);
        }}
      >
        <article className="letter-reading">
          <header className="letter-heading">
            <span className="letter-id">书信 {letter.number}</span>
            <h2>致{letter.recipient}</h2>
            <time>{formatLetterDate(letter)}</time>
          </header>

          {!showLayer3 ? (
            <AnnotatedLetterText letter={letter} showEntity={showLayer1} showEvent={showLayer2} />
          ) : hasActData ? (
            <div className="behavior-block-view">
              {mergedActs.map((act, i) => (
                <div key={i} className="behavior-block has-act">
                  <div className="behavior-text">
                    <AnnotatedLetterText
                      letter={letter}
                      showEntity={showLayer1}
                      showEvent={showLayer2}
                      rangeStart={act.start}
                      rangeEnd={act.end}
                    />
                  </div>
                  <div className="behavior-annotation">
                    {(() => {
                      const expl = getActExplanation(act);
                      return (
                        <>
                          <span className="behavior-type">{getActTypeLabel(act)}{expl ? "：" : ""}</span>
                          {expl ? <span className="behavior-description">{expl}</span> : null}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <AnnotatedLetterText letter={letter} showEntity={showLayer1} showEvent={showLayer2} />
              <p className="behavior-empty-hint">该书信暂未添加行为标注</p>
            </>
          )}

          <footer className="source-citation">
            <span>来源</span><p>{letter.source ?? "暂无来源字段"}</p>
            <Link className="letter-detail-link" href={`/letter/${encodeURIComponent(letter.id)}`}>查看完整书信信息 <i aria-hidden="true">→</i></Link>
          </footer>
        </article>
      </LetterAnnotationIndex>
    </section>
  );
}
