"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { eventTypeMeta } from "@/lib/config";
import { formatLetterDate, getAllEvents, getEntityCategory, getTopicBySlug } from "@/lib/data-adapter";

export function TopicDetailPage({ slug }: { slug: string }) {
  const topic = getTopicBySlug(slug);
  const [query, setQuery] = useState("");
  const entries = useMemo(() => {
    if (!topic?.entityCode) return [];
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return getEntityCategory(topic.entityCode).filter((entry) => !normalized || [entry.canonical, ...entry.aliases].join(" ").toLocaleLowerCase("zh-CN").includes(normalized));
  }, [query, topic]);
  const events = useMemo(() => {
    if (topic?.kind !== "event") return [];
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return getAllEvents().filter(({ letter, event }) => !normalized || `${letter.recipient}${letter.year ?? ""}${event.originalText}`.toLocaleLowerCase("zh-CN").includes(normalized));
  }, [query, topic]);

  if (!topic) return <main className="site-container page-state">未找到这个实体专题。</main>;

  return (
    <main className="topic-detail-page site-container">
      <Link className="back-link" href="/topics">← 返回实体专题检索</Link>
      <header className="topic-detail-heading">
        <div><span>{topic.englishLabel} · ENTITY TOPIC</span><h1>{topic.name}专题</h1><p>{topic.description}</p></div>
        <dl><div><dt>{topic.entityCount ?? "—"}</dt><dd>{topic.kind === "event" ? "事件类型" : "规范实体"}</dd></div><div><dt>{topic.mentionCount ?? "—"}</dt><dd>{topic.kind === "event" ? "标注事件" : "出现次数"}</dd></div><div><dt>{topic.letterCount ?? "—"}</dt><dd>相关书信</dd></div></dl>
      </header>
      <label className="topic-search"><span>专题内检索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${topic.name}……`} /></label>

      {topic.kind === "entity" ? (
        entries.length ? <section className="entity-index-list" aria-label={`${topic.name}实体列表`}>
          {entries.map((entry) => <Link href={`/entity/${entry.type}/${encodeURIComponent(entry.canonical)}`} key={`${entry.type}-${entry.canonical}`}><span className="index-mark">{entry.type}</span><span><strong>{entry.canonical}</strong><small>{entry.aliases.length ? `异名：${entry.aliases.slice(0, 3).join("、")}` : topic.description}</small></span><span className="entry-stat">{entry.count} 次出现<br />{entry.letterIds.length} 封信</span><i aria-hidden="true">→</i></Link>)}
        </section> : <TopicEmpty />
      ) : (
        events.length ? <section className="event-index-list" aria-label="事件列表">
          {events.map(({ letter, event }) => <article key={`${letter.id}-${event.id}`}><span>{eventTypeMeta[event.type].label}<b>{event.type}</b></span><div><p>{event.originalText}</p><small>{event.stage ?? "状态暂无数据"} · 致{letter.recipient} · {formatLetterDate(letter)}</small></div><Link href={`/letter/${encodeURIComponent(letter.id)}`}>查看原信 →</Link></article>)}
        </section> : <TopicEmpty />
      )}
    </main>
  );
}

function TopicEmpty() {
  return <div className="empty-index"><span>数据整理中</span><p>专题入口与列表结构已经保留，接入对应标注数据后将在此自动显示。</p></div>;
}
