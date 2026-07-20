"use client";

import Link from "next/link";
import { useState } from "react";
import { formatLetterDate, getFeaturedLetters } from "@/lib/data-adapter";
import { AnnotatedLetterText } from "./AnnotatedLetterText";

export function FeaturedLetterViewer() {
  const letters = getFeaturedLetters();
  const [index, setIndex] = useState(0);
  const [layers, setLayers] = useState({ entity: true, event: true, act: true });
  const letter = letters[index];

  if (!letter) return <p>暂无优秀示例配置。</p>;

  function toggleLayer(layer: keyof typeof layers) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
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
        <button type="button" aria-pressed={layers.entity} className={layers.entity ? "selected" : ""} onClick={() => toggleLayer("entity")}>
          <i className="control-dot entity-dot" /> 第一层标注 {layers.entity ? "✓" : ""}
        </button>
        <button type="button" aria-pressed={layers.event} className={layers.event ? "selected" : ""} onClick={() => toggleLayer("event")}>
          <i className="control-dot event-dot" /> 第二层标注 {layers.event ? "✓" : ""}
        </button>
        <button type="button" aria-pressed={layers.act} className={layers.act ? "selected" : ""} onClick={() => toggleLayer("act")} title="现有语料暂缺行动层标注数据">
          <i className="control-dot act-dot" /> 第三层标注 {layers.act ? "✓" : ""}
        </button>
        <button className="hide-all" type="button" onClick={() => setLayers({ entity: false, event: false, act: false })}>隐藏全部标注</button>
      </div>

      <article className="letter-reading">
        <header className="letter-heading">
          <span className="letter-id">书信 {letter.number}</span>
          <h2>致{letter.recipient}</h2>
          <time>{formatLetterDate(letter)}</time>
        </header>
        <AnnotatedLetterText letter={letter} showEntity={layers.entity} showEvent={layers.event} showAct={layers.act} />
        <footer className="source-citation">
          <span>来源</span><p>{letter.source ?? "暂无来源字段"}</p>
          <Link className="letter-detail-link" href={`/letter/${encodeURIComponent(letter.id)}`}>查看完整书信信息 <i aria-hidden="true">→</i></Link>
        </footer>
      </article>
    </section>
  );
}
