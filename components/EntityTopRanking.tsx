"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { entityTypeMeta, eventTypeMeta } from "@/lib/config";
import { dataset } from "@/lib/data-adapter";
import type { EntityCatalogEntry, EntityType, EventType } from "@/lib/types";

const EVENT_ORDER: EventType[] = ["BIB", "ACA", "SOC", "POL", "FAM"];

const EVENT_COLORS: Record<EventType, string> = {
  BIB: "#746d91",
  ACA: "#557985",
  SOC: "#956d71",
  POL: "#88764f",
  FAM: "#687d70",
};

const RANKING_TITLES: Partial<Record<EntityType, string>> = {
  OFF: "常见官职与身份 TOP 10",
  KIN: "常见亲属称谓 TOP 10",
  AST: "高频星命术语 TOP 10",
};

export const RANKABLE_ENTITY_TYPES: EntityType[] = ["PER", "LOC", "BOK", "VER", "ORG", "OFF", "KIN", "AST"];

type SortMode = "letters" | "mentions";

type RankedEntity = EntityCatalogEntry & {
  letterCount: number;
  eventCounts: Record<EventType, number>;
  eventTotal: number;
  dominantEvent: EventType | null;
};

function buildEventProfile(entry: EntityCatalogEntry): Pick<RankedEntity, "eventCounts" | "eventTotal" | "dominantEvent"> {
  const eventCounts = Object.fromEntries(EVENT_ORDER.map((type) => [type, 0])) as Record<EventType, number>;

  for (const letterId of new Set(entry.letterIds)) {
    const mentions = (dataset.entitiesByLetter[letterId] ?? []).filter(
      (mention) => mention.type === entry.type && mention.canonical === entry.canonical && mention.start >= 0,
    );
    const events = (dataset.eventsByLetter[letterId] ?? []).filter((event) => event.start >= 0);
    const matchedEventIds = new Set<string>();

    for (const mention of mentions) {
      for (const event of events) {
        if (mention.start >= event.end || mention.end <= event.start || matchedEventIds.has(event.id)) continue;
        matchedEventIds.add(event.id);
        eventCounts[event.type] += 1;
      }
    }
  }

  const eventTotal = Object.values(eventCounts).reduce((sum, count) => sum + count, 0);
  const dominantEvent = eventTotal
    ? EVENT_ORDER.reduce((best, current) => eventCounts[current] > eventCounts[best] ? current : best)
    : null;

  return { eventCounts, eventTotal, dominantEvent };
}

export function EntityTopRanking({ entries, type }: { entries: EntityCatalogEntry[]; type: EntityType }) {
  const [sortMode, setSortMode] = useState<SortMode>("letters");

  const ranked = useMemo<RankedEntity[]>(() => {
    const sorted = [...entries].sort((a, b) => {
      const aLetters = new Set(a.letterIds).size;
      const bLetters = new Set(b.letterIds).size;
      const primary = sortMode === "letters" ? bLetters - aLetters : b.count - a.count;
      return primary || b.count - a.count || bLetters - aLetters || a.canonical.localeCompare(b.canonical, "zh-CN");
    });

    return sorted.slice(0, 10).map((entry) => ({
      ...entry,
      letterCount: new Set(entry.letterIds).size,
      ...buildEventProfile(entry),
    }));
  }, [entries, sortMode]);

  if (!ranked.length) return null;

  const title = RANKING_TITLES[type] ?? `高频${entityTypeMeta[type].label} TOP 10`;
  const preview = ranked.slice(0, 3).map((entry) => entry.canonical).join("、");

  return (
    <details className="entity-ranking-drawer" open>
      <summary>
        <span className="entity-ranking-heading">
          <small>ENTITY RANKING</small>
          <strong>{title}</strong>
          <em>{preview}{ranked.length > 3 ? "……" : ""}</em>
        </span>
        <span className="entity-ranking-toggle" aria-hidden="true">
          <i className="when-open">收起 ↑</i>
          <i className="when-closed">展开 ↓</i>
        </span>
      </summary>

      <div className="entity-ranking-body">
        <div className="entity-ranking-toolbar">
          <p>排名按规范实体统计；色带表示实体在五类事件中的语境构成。</p>
          <div aria-label="排行依据">
            <span>排行依据</span>
            <button type="button" className={sortMode === "letters" ? "is-active" : ""} onClick={() => setSortMode("letters")}>涉及书信</button>
            <button type="button" className={sortMode === "mentions" ? "is-active" : ""} onClick={() => setSortMode("mentions")}>提及次数</button>
          </div>
        </div>

        <div className="entity-ranking-grid">
          {ranked.map((entry, index) => (
            <Link
              className="entity-ranking-card"
              href={`/entity/${entry.type}/${encodeURIComponent(entry.canonical)}`}
              key={`${entry.type}-${entry.canonical}`}
              aria-label={`第${index + 1}名，${entry.canonical}，涉及${entry.letterCount}封书信，提及${entry.count}次`}
            >
              <span className="ranking-number">{String(index + 1).padStart(2, "0")}</span>
              <strong title={entry.canonical}>{entry.canonical}</strong>
              <p><b>{entry.letterCount}</b>封 <i>·</i> {entry.count}次</p>
              <span className="event-spectrum" aria-label="五类事件语境构成">
                {EVENT_ORDER.map((eventType) => entry.eventCounts[eventType] > 0 ? (
                  <i
                    key={eventType}
                    style={{ background: EVENT_COLORS[eventType], flexGrow: entry.eventCounts[eventType] }}
                    title={`${eventTypeMeta[eventType].label}：${entry.eventCounts[eventType]}`}
                  />
                ) : null)}
              </span>
              <small>{entry.dominantEvent ? `主要：${eventTypeMeta[entry.dominantEvent].label}` : "事件语境待整理"}</small>
              <span className="ranking-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>

        <div className="event-spectrum-legend" aria-label="事件语境图例">
          {EVENT_ORDER.map((eventType) => (
            <span key={eventType}><i style={{ background: EVENT_COLORS[eventType] }} />{eventTypeMeta[eventType].label}</span>
          ))}
        </div>
      </div>
    </details>
  );
}
