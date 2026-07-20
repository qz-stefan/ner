"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { eventTypeMeta } from "@/lib/config";
import { formatLetterDate, getLetter, searchScopeLabels, splitLetterIntoTranslationPairs } from "@/lib/data-adapter";
import type { Letter, SearchScope } from "@/lib/types";
import { AnnotatedLetterText } from "./AnnotatedLetterText";
import { HighlightedText } from "./HighlightedText";

export function LetterDetailPage({ id, query = "", scope = "fulltext", matchStart }: { id: string; query?: string; scope?: SearchScope; matchStart?: number }) {
  const letter = getLetter(id);
  const [showTranslation, setShowTranslation] = useState(true);
  const [layers, setLayers] = useState({ entity: true, event: true, act: true });
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
  const pairs = splitLetterIntoTranslationPairs(letter);

  return (
    <main className="letter-detail-page site-container">
      <Link className="back-link" href="/letters">← 返回书信检索</Link>
      <header className="letter-detail-heading"><span>LETTER {letter.number}</span><h1>致{scope === "recipient" && query ? <HighlightedText text={letter.recipient} query={query} markId="search-match" /> : letter.recipient}</h1><time>{formatLetterDate(letter)}</time></header>
      {query ? <p className="detail-match-note">由“{searchScopeLabels[scope]}”检索进入，已定位并标出“{query}”。</p> : null}
      <div className="detail-controls">
        <button type="button" className={showTranslation ? "selected" : ""} aria-pressed={showTranslation} onClick={() => setShowTranslation(!showTranslation)}>显示白话文翻译 {showTranslation ? "✓" : ""}</button>
        {(["entity", "event", "act"] as const).map((layer) => <button type="button" key={layer} className={layers[layer] ? "selected" : ""} aria-pressed={layers[layer]} onClick={() => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}>{layer === "entity" ? "第一层标注" : layer === "event" ? "第二层标注" : "第三层标注"} {layers[layer] ? "✓" : ""}</button>)}
      </div>

      {showTranslation ? (
        <article className="parallel-reading">
          {pairs.map((pair, index) => (
            <section className="paragraph-pair" key={`${pair.event?.id ?? "plain"}-${index}`}>
              {pair.event ? <span className="pair-event">{eventTypeMeta[pair.event.type].label} · {pair.event.type}</span> : null}
              <div className="pair-annotated-original"><AnnotatedLetterText letter={letter as Letter} showEntity={layers.entity} showEvent={layers.event} showAct={layers.act} rangeStart={pair.start} rangeEnd={pair.end} searchMatch={searchMatch} /></div>
              {pair.translation ? <div className="translation-paragraph"><span>白话</span><p>{pair.translation}</p></div> : <div className="translation-paragraph missing"><span>白话</span><p>暂无对应译文字段</p></div>}
            </section>
          ))}
        </article>
      ) : (
        <article className="detail-original-only"><AnnotatedLetterText letter={letter as Letter} showEntity={layers.entity} showEvent={layers.event} showAct={layers.act} searchMatch={searchMatch} /></article>
      )}

      <footer className="letter-record"><div><span>收信人</span><p>{scope === "recipient" && query ? <HighlightedText text={letter.recipient} query={query} /> : letter.recipient}</p></div><div><span>时间</span><p>{formatLetterDate(letter)}</p></div><div><span>来源</span><p>{scope === "source" && query ? <HighlightedText text={letter.source ?? "暂无来源字段"} query={query} markId="search-match" /> : letter.source ?? "暂无来源字段"}</p></div></footer>
    </main>
  );
}
