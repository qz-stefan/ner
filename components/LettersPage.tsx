"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { entityTypeMeta } from "@/lib/config";
import { formatLetterDate, getAllLetters, getLetterEntitySummary, getLetterExcerpt } from "@/lib/data-adapter";
import { LetterSearchBar } from "./LetterSearchBar";

export function LettersPage() {
  const [query, setQuery] = useState("");
  const letters = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return getAllLetters().filter((letter) => {
      if (!normalized) return true;
      return [letter.id, letter.number, letter.recipient, letter.year ?? "", letter.ganzhiDate ?? "", letter.text]
        .join("\n")
        .toLocaleLowerCase("zh-CN")
        .includes(normalized);
    });
  }, [query]);

  return (
    <main className="letters-page">
      <div className="search-band"><div className="site-container"><LetterSearchBar key={query} initialValue={query} onSearch={setQuery} /></div></div>
      <div className="site-container letters-content">
        <header className="page-heading">
          <div><span>ALL CORRESPONDENCE</span><h1>全部书信</h1><p>按收信人、时间或原文关键词检索；未输入条件时展示全部书信。</p></div>
          <p><strong>{letters.length}</strong><span>{query ? "封符合条件" : "封书信"}</span></p>
        </header>

        {letters.length ? (
          <section className="letter-list" aria-label="全部书信列表">
            {letters.map((letter) => {
              const entities = getLetterEntitySummary(letter.id);
              return (
                <article className="letter-list-item" key={letter.id}>
                  <span className="letter-list-number">{letter.number}</span>
                  <div className="letter-list-body">
                    <header><div><h2>致{letter.recipient}</h2><p>收信人：{letter.recipient}</p></div><time>{formatLetterDate(letter)}</time></header>
                    <p className="letter-excerpt">{getLetterExcerpt(letter)}</p>
                    <footer>
                      <span>来源：{letter.source ?? "暂无来源字段"}</span>
                      {entities.count ? <span>实体 {entities.count} 处 · {entities.types.slice(0, 4).map((type) => entityTypeMeta[type].label).join("、")}</span> : <span>实体数据整理中</span>}
                      <Link href={`/letter/${encodeURIComponent(letter.id)}`}>阅读原信 <i aria-hidden="true">→</i></Link>
                    </footer>
                  </div>
                </article>
              );
            })}
          </section>
        ) : <div className="empty-state"><span>〇</span><h2>未找到对应书信</h2><p>可尝试输入收信人、年份、干支、原文词句或三位书信编号。</p></div>}
      </div>
    </main>
  );
}
