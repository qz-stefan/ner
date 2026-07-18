"use client";

import Link from "next/link";
import { useState } from "react";
import { eventTypeMeta } from "@/lib/config";
import { formatLetterDate, getLetter, splitLetterIntoTranslationPairs } from "@/lib/data-adapter";
import type { Letter } from "@/lib/types";
import { AnnotatedLetterText } from "./AnnotatedLetterText";

export function LetterDetailPage({ id }: { id: string }) {
  const letter = getLetter(id);
  const [showTranslation, setShowTranslation] = useState(true);
  const [layers, setLayers] = useState({ entity: true, event: true, act: true });
  if (!letter) return <main className="site-container page-state">未找到书信 {id}。</main>;
  const pairs = splitLetterIntoTranslationPairs(letter);

  return (
    <main className="letter-detail-page site-container">
      <Link className="back-link" href="/">← 返回实体标注主页</Link>
      <header className="letter-detail-heading"><span>LETTER {letter.number}</span><h1>致{letter.recipient}</h1><time>{formatLetterDate(letter)}</time></header>
      <div className="detail-controls">
        <button type="button" className={showTranslation ? "selected" : ""} aria-pressed={showTranslation} onClick={() => setShowTranslation(!showTranslation)}>显示白话文翻译 {showTranslation ? "✓" : ""}</button>
        {(["entity", "event", "act"] as const).map((layer) => <button type="button" key={layer} className={layers[layer] ? "selected" : ""} aria-pressed={layers[layer]} onClick={() => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}>{layer === "entity" ? "实体层" : layer === "event" ? "事件层" : "行动层"} {layers[layer] ? "✓" : ""}</button>)}
      </div>

      {showTranslation ? (
        <article className="parallel-reading">
          {pairs.map((pair, index) => (
            <section className="paragraph-pair" key={`${pair.event?.id ?? "plain"}-${index}`}>
              {pair.event ? <span className="pair-event">{eventTypeMeta[pair.event.type].label} · {pair.event.type}</span> : null}
              <div className="pair-annotated-original"><AnnotatedLetterText letter={letter as Letter} showEntity={layers.entity} showEvent={layers.event} showAct={layers.act} rangeStart={pair.start} rangeEnd={pair.end} /></div>
              {pair.translation ? <div className="translation-paragraph"><span>白话</span><p>{pair.translation}</p></div> : <div className="translation-paragraph missing"><span>白话</span><p>暂无对应译文字段</p></div>}
            </section>
          ))}
        </article>
      ) : (
        <article className="detail-original-only"><AnnotatedLetterText letter={letter as Letter} showEntity={layers.entity} showEvent={layers.event} showAct={layers.act} /></article>
      )}

      <footer className="letter-record"><div><span>来源</span><p>{letter.source ?? "暂无来源字段"}</p></div><div><span>书信 ID</span><p>{letter.id}</p></div><div><span>底本信息</span><p>暂无数据</p></div></footer>
    </main>
  );
}
