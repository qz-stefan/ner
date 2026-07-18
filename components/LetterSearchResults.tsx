"use client";

import Link from "next/link";
import { formatLetterDate, searchLetters } from "@/lib/data-adapter";

export function LetterSearchResults({ query, onClear }: { query: string; onClear: () => void }) {
  const results = searchLetters(query);
  return (
    <section className="search-results" aria-live="polite">
      <div className="results-title">
        <div><span>LETTER SEARCH</span><h1>书信检索结果</h1><p>“{query}” · 共显示 {results.length} 封</p></div>
        <button type="button" onClick={onClear}>返回优秀示例</button>
      </div>
      {results.length ? (
        <div className="result-list">
          {results.map(({ letter, snippet, matchStart, matchLength }) => (
            <article className="result-item" key={letter.id}>
              <span className="result-number">{letter.number}</span>
              <div>
                <p><b>致{letter.recipient}</b><time>{formatLetterDate(letter)}</time></p>
                <blockquote>
                  {matchStart >= 0 ? <>{snippet.slice(0, matchStart)}<mark>{snippet.slice(matchStart, matchStart + matchLength)}</mark>{snippet.slice(matchStart + matchLength)}</> : snippet}
                </blockquote>
                <Link href={`/letter/${encodeURIComponent(letter.id)}`}>查看完整书信 →</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><span>〇</span><h2>未找到对应书信</h2><p>可尝试输入收信人、年份、干支、原文词句或三位书信编号。</p></div>
      )}
    </section>
  );
}
