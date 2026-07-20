"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { entityTypeMeta, eventTypeMeta } from "@/lib/config";
import { getCategoryMeta, getEntityCategory, getEventsByType } from "@/lib/data-adapter";
import type { EntityType, EventType } from "@/lib/types";
import { TopicHero } from "@/components/TopicHero";

export function CategoryIndexPage({ layer, code }: { layer: string; code: string }) {
  const meta = getCategoryMeta(layer, code);
  const [query, setQuery] = useState("");
  const [activeFacet, setActiveFacet] = useState("全部");
  const entityEntries = useMemo(
    () => layer === "entity" ? getEntityCategory(code as EntityType) : [],
    [code, layer],
  );
  const eventEntries = useMemo(
    () => layer === "event" ? getEventsByType(code as EventType) : [],
    [code, layer],
  );

  const facets = useMemo(() => {
    if (layer === "entity") {
      return ["全部", ...new Set(entityEntries.flatMap((entry) => entry.subtypes).filter(Boolean))].slice(0, 14);
    }
    if (layer === "event") return ["全部", ...new Set(eventEntries.map(({ event }) => event.stage).filter(Boolean) as string[])];
    return ["全部"];
  }, [entityEntries, eventEntries, layer]);

  const filteredEntities = entityEntries.filter((entry) => {
    const queryMatch = !query || [entry.canonical, ...entry.aliases].join(" ").includes(query);
    const facetMatch = activeFacet === "全部" || entry.subtypes.includes(activeFacet);
    return queryMatch && facetMatch;
  });
  const filteredEvents = eventEntries.filter(({ letter, event }) => {
    const queryMatch = !query || `${letter.recipient}${letter.id}${event.originalText}`.includes(query);
    const facetMatch = activeFacet === "全部" || event.stage === activeFacet;
    return queryMatch && facetMatch;
  });

  if (!meta) return <div className="page-state">未找到对应的实体专题。</div>;

  const layerLabel = layer === "entity" ? "第一层标注 · 实体层 NER" : layer === "event" ? "第二层标注 · 事件层 EVT" : "第三层标注 · 行动层 ACT";
  const totalValue = layer === "entity"
    ? ("canonicalCount" in meta.stats ? meta.stats.canonicalCount : 0)
    : layer === "event"
      ? ("eventCount" in meta.stats ? meta.stats.eventCount : 0)
      : ("paragraphCount" in meta.stats ? meta.stats.paragraphCount : 0);
  const totalUnit = layer === "entity" ? "个规范条目" : layer === "event" ? "个事件" : "个段落";
  const letterCount = "letterCount" in meta.stats ? meta.stats.letterCount : 0;

  return (
    <main className="index-page site-container">
      <Link className="back-link" href="/topics">← 返回实体分类检索</Link>
      <TopicHero
        eyebrow={`${layerLabel} · ${code}`}
        title={`${meta.label}专题`}
        description={"prompt" in meta ? meta.prompt : meta.definition}
        metrics={[
          { value: totalValue.toLocaleString("zh-CN"), label: totalUnit },
          { value: letterCount.toLocaleString("zh-CN"), label: "封书信" },
        ]}
      />

      <section className="index-tools" aria-label="专题检索工具">
        <label><span>专题内部检索</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${meta.label}……`} /></label>
        <div className="facet-row" aria-label="子类别">
          {facets.map((facet) => <button type="button" className={activeFacet === facet ? "selected" : ""} onClick={() => setActiveFacet(facet)} key={facet}>{facet}</button>)}
        </div>
      </section>

      {layer === "entity" ? (
        filteredEntities.length ? <section className="entity-index-list" aria-label={`${meta.label}条目`}>
          {filteredEntities.map((entry) => (
            <Link href={`/entity/${entry.type}/${encodeURIComponent(entry.canonical)}`} key={`${entry.type}-${entry.canonical}`}>
              <span className={`index-mark entity-${entry.type.toLowerCase()}`}>{entry.type}</span>
              <span><strong>{entry.canonical}</strong><small>{entry.aliases.length ? `异名：${entry.aliases.slice(0, 3).join("、")}` : entityTypeMeta[entry.type].prompt}</small></span>
              <span className="entry-stat">{entry.count} 次出现<br />{entry.letterIds.length} 封信</span>
              <i aria-hidden="true">→</i>
            </Link>
          ))}
        </section> : <EmptyIndex />
      ) : null}

      {layer === "event" ? (
        filteredEvents.length ? <section className="event-index-list">
          {filteredEvents.slice(0, 120).map(({ letter, event }) => (
            <article key={`${letter.id}-${event.id}`}>
              <span>{eventTypeMeta[event.type].label}<b>{event.type}</b></span>
              <div><p>{event.originalText}</p><small>{event.stage ?? "状态暂无数据"} · 致{letter.recipient} · {letter.id}</small></div>
              <Link href={`/letter/${encodeURIComponent(letter.id)}`}>查看原信 →</Link>
            </article>
          ))}
        </section> : <EmptyIndex />
      ) : null}

      {layer === "act" ? <EmptyIndex message="行动层数据目录当前为空；页面入口、字段和段落级视觉已预留，接入真实 ACT 文件后将自动显示。" /> : null}
    </main>
  );
}

function EmptyIndex({ message = "现有数据中暂无这一类型的标注条目。" }: { message?: string }) {
  return <div className="empty-index"><span>暂无数据</span><p>{message}</p></div>;
}
