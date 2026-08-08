"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { entityStyleVariables, entityTypeMeta } from "@/lib/config";
import { dataset, formatLetterDate, getEntityCategory, getEntityOccurrences } from "@/lib/data-adapter";
import { getSecondaryCategories } from "@/lib/topic-config";
import type { EntityCatalogEntry, EntityType } from "@/lib/types";

type EntitySort = "frequency" | "name";

const entityTypes = Object.keys(dataset.entityStats) as EntityType[];

function getSubtypeLabel(entry: EntityCatalogEntry) {
  if (!entry.subtypes.length) return "未分类";
  const subtypeMap = new Map(
    getSecondaryCategories(entry.type).map((category) => [category.code, category.label]),
  );
  return entry.subtypes.map((code) => subtypeMap.get(code) ?? code).join("、");
}

function EntityExpandedDetail({ entry }: { entry: EntityCatalogEntry }) {
  const occurrences = useMemo(() => getEntityOccurrences(entry), [entry]);
  const aliases = entry.aliases.length ? entry.aliases.join("、") : "暂无别名";

  return (
    <div className="entity-inline-detail">
      <div className="entity-inline-summary">
        <div>
          <span>规范实体</span>
          <strong>{entry.canonical}</strong>
          <small>{entityTypeMeta[entry.type].label} · {entry.type}</small>
        </div>
        <dl>
          <div><dt>{entry.count.toLocaleString("zh-CN")}</dt><dd>次出现</dd></div>
          <div><dt>{entry.letterIds.length.toLocaleString("zh-CN")}</dt><dd>封书信</dd></div>
        </dl>
      </div>
      <p className="entity-alias-line"><span>别名</span>{aliases}</p>
      <div className="entity-occurrence-preview">
        <h4>原文片段</h4>
        {occurrences.slice(0, 3).map(({ letter, mention }, index) => {
          const start = Math.max(0, mention.start - 28);
          const end = Math.min(letter.text.length, mention.end + 42);
          return (
            <article key={`${letter.id}-${mention.start}-${index}`}>
              <header>
                <span>书信 {letter.number} · 致{letter.recipient}</span>
                <time>{formatLetterDate(letter)}</time>
              </header>
              <blockquote>
                {start > 0 ? "……" : ""}
                {letter.text.slice(start, mention.start)}
                <mark>{letter.text.slice(mention.start, mention.end)}</mark>
                {letter.text.slice(mention.end, end)}
                {end < letter.text.length ? "……" : ""}
              </blockquote>
              <Link href={`/letter/${encodeURIComponent(letter.id)}`}>查看对应书信 <i aria-hidden="true">→</i></Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function EntityCategoryBrowser() {
  const [activeType, setActiveType] = useState<EntityType>(entityTypes.includes("PER") ? "PER" : entityTypes[0] ?? "PER");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<EntitySort>("frequency");
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  const meta = entityTypeMeta[activeType];
  const stats = dataset.entityStats[activeType];
  const entries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    const filtered = getEntityCategory(activeType).filter((entry) => {
      if (!normalizedQuery) return true;
      return [entry.canonical, ...entry.aliases]
        .join(" ")
        .toLocaleLowerCase("zh-CN")
        .includes(normalizedQuery);
    });
    const collator = new Intl.Collator("zh-CN", { usage: "sort", sensitivity: "base" });
    return [...filtered].sort((a, b) => (
      sort === "frequency"
        ? b.count - a.count || collator.compare(a.canonical, b.canonical)
        : collator.compare(a.canonical, b.canonical)
    ));
  }, [activeType, query, sort]);

  function selectType(type: EntityType) {
    setActiveType(type);
    setExpandedEntity(null);
  }

  return (
    <div className="entity-browser" aria-labelledby="entity-browser-title">
      <header className="entity-browser-heading">
        <h2 id="entity-browser-title">实体分类</h2>
        <p>按实体类型浏览书信中的规范实体及其出现情况。</p>
      </header>

      <div className="entity-type-tabs" role="tablist" aria-label="实体类型">
        {entityTypes.map((type) => {
          const typeStats = dataset.entityStats[type];
          const typeMeta = entityTypeMeta[type];
          const selected = activeType === type;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              className={selected ? "active" : undefined}
              style={entityStyleVariables(type)}
              onClick={() => selectType(type)}
              key={type}
            >
              <strong>{typeMeta.label}</strong>
              <small>{type} · {typeStats.canonicalCount.toLocaleString("zh-CN")}</small>
            </button>
          );
        })}
      </div>

      <section className="entity-category-detail" style={entityStyleVariables(activeType)}>
        <header className="entity-category-summary">
          <div>
            <span>{activeType}</span>
            <h3>{meta.label}</h3>
            <p>{meta.prompt}。</p>
          </div>
          <dl>
            <div><dt>{stats.canonicalCount.toLocaleString("zh-CN")}</dt><dd>规范实体</dd></div>
            <div><dt>{stats.mentionCount.toLocaleString("zh-CN")}</dt><dd>次出现</dd></div>
            <div><dt>{stats.letterCount.toLocaleString("zh-CN")}</dt><dd>封相关书信</dd></div>
          </dl>
        </header>

        <div className="entity-browser-tools">
          <label>
            <span>搜索实体</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setExpandedEntity(null);
              }}
              placeholder={`输入${meta.label}规范名或别名`}
            />
          </label>
          <label>
            <span>排序</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as EntitySort)}>
              <option value="frequency">出现次数从高到低</option>
              <option value="name">名称拼音顺序</option>
            </select>
          </label>
        </div>

        <div className="entity-list-status" aria-live="polite">
          <span>实体列表</span>
          <p>{query.trim() ? `找到 ${entries.length.toLocaleString("zh-CN")} 个匹配实体` : `共 ${entries.length.toLocaleString("zh-CN")} 个规范实体`}</p>
        </div>

        {entries.length ? (
          <div className="entity-browser-list">
            <div className="entity-browser-list-head" aria-hidden="true">
              <span>实体名称</span><span>实体子类</span><span>出现次数</span><span>相关书信</span><span />
            </div>
            {entries.map((entry) => {
              const key = `${entry.type}:${entry.canonical}`;
              const expanded = expandedEntity === key;
              return (
                <article className={`entity-browser-row${expanded ? " expanded" : ""}`} key={key}>
                  <button
                    type="button"
                    className="entity-browser-row-trigger"
                    aria-expanded={expanded}
                    onClick={() => setExpandedEntity(expanded ? null : key)}
                  >
                    <strong>{entry.canonical}</strong>
                    <span>{getSubtypeLabel(entry)}</span>
                    <span><b>{entry.count.toLocaleString("zh-CN")}</b><small>次出现</small></span>
                    <span><b>{entry.letterIds.length.toLocaleString("zh-CN")}</b><small>封书信</small></span>
                    <i aria-hidden="true">{expanded ? "−" : "+"}</i>
                  </button>
                  {expanded ? <EntityExpandedDetail entry={entry} /> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="entity-browser-empty">
            <span>未找到匹配实体</span>
            <p>请尝试输入其他规范名或别名。</p>
          </div>
        )}
      </section>
    </div>
  );
}
