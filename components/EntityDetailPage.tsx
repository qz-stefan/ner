"use client";

import Link from "next/link";
import { useState } from "react";
import { entityTypeMeta } from "@/lib/config";
import { formatLetterDate, getEntity, getEntityAnnotation, getEntityOccurrences } from "@/lib/data-adapter";
import type { EntityType } from "@/lib/types";
import { TopicHero } from "@/components/TopicHero";
import { EntityNetworkOverlay } from "@/components/EntityNetworkOverlay";

export function EntityDetailPage({ type, name }: { type: EntityType; name: string }) {
  const entry = getEntity(type, name);
  const [tableView, setTableView] = useState(false);
  if (!entry) return <main className="site-container page-state">未找到“{name}”的实体数据。</main>;
  const occurrences = getEntityOccurrences(entry);
  const annotation = getEntityAnnotation(type, name);
  const subtypeLabel = entry.subtypes.length ? entry.subtypes.join("、") : `${entityTypeMeta[type].label} · ${type}`;
  const hasAliases = entry.aliases.length > 0;

  return (
    <main className="entity-detail-page site-container">
      <Link className="back-link" href={`/category/entity/${type}`}>← 返回{entityTypeMeta[type].label}索引</Link>
      <TopicHero
        eyebrow={subtypeLabel}
        title={entry.canonical}
        subtitle={hasAliases ? `别名：${entry.aliases.join("、")}` : undefined}
        description={annotation ?? `${entityTypeMeta[type].prompt}。当前页面仅呈现语料中可验证的规范名、异名与共现记录。`}
        metrics={[
          { value: (entry.count ?? 0).toLocaleString("zh-CN"), label: "次出现" },
          { value: (entry.letterIds?.length ?? 0).toLocaleString("zh-CN"), label: "封书信" },
        ]}
      />
      <EntityNetworkOverlay center={entry} />

      <section className="occurrence-section">
        <div className="section-heading"><div><span>CORRESPONDENCE</span><h2>相关书信</h2></div><div className="view-toggle"><button type="button" className={!tableView ? "selected" : ""} onClick={() => setTableView(false)}>原文片段</button><button type="button" className={tableView ? "selected" : ""} onClick={() => setTableView(true)}>表格模式</button></div></div>
        {tableView ? (
          <div className="table-wrap"><table><thead><tr><th>书信 ID</th><th>收信人</th><th>时间</th><th>本信出现次数</th><th>来源</th></tr></thead><tbody>
            {entry.letterIds.map((letterId) => {
              const group = occurrences.filter(({ letter }) => letter.id === letterId);
              const letter = group[0]?.letter;
              return letter ? <tr key={letterId}><td><Link href={`/letter/${encodeURIComponent(letter.id)}`}>{letter.id}</Link></td><td>{letter.recipient}</td><td>{formatLetterDate(letter)}</td><td>{group.length}</td><td>{letter.source ?? "暂无数据"}</td></tr> : null;
            })}
          </tbody></table></div>
        ) : (
          <div className="occurrence-list">
            {occurrences.slice(0, 60).map(({ letter, mention }, index) => {
              const start = Math.max(0, mention.start - 34);
              const end = Math.min(letter.text.length, mention.end + 52);
              return <article key={`${letter.id}-${mention.start}-${index}`}><span>{letter.number}</span><div><p>致{letter.recipient} · {formatLetterDate(letter)}</p><blockquote>{start > 0 ? "……" : ""}{letter.text.slice(start, mention.start)}<mark>{letter.text.slice(mention.start, mention.end)}</mark>{letter.text.slice(mention.end, end)}{end < letter.text.length ? "……" : ""}</blockquote><Link href={`/letter/${encodeURIComponent(letter.id)}`}>查看完整书信 →</Link></div></article>;
            })}
          </div>
        )}
      </section>

    </main>
  );
}
