"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ReactEChartsCore from "echarts-for-react/esm/core";
import { echarts } from "@/lib/analysis/echarts-builder";
import { annotationStyles, entityTypeMeta } from "@/lib/config";
import { dataset, getEntity, getRelatedEntities } from "@/lib/data-adapter";
import type { EntityCatalogEntry, EntityType } from "@/lib/types";

const SAMPLE_ENTITIES: { type: EntityType; name: string }[] = [
  { type: "VER", name: "旧本" },
  { type: "PER", name: "张元济" },
  { type: "VER", name: "宋本" },
  { type: "LOC", name: "苏州" },
];

const TYPE_ORDER = Object.keys(entityTypeMeta) as EntityType[];

type RelatedNode = {
  entry: EntityCatalogEntry;
  sharedLetters: number;
};

export function EntityCooccurrenceDemo({ initialCenter, embedded = false }: { initialCenter?: EntityCatalogEntry; embedded?: boolean } = {}) {
  const [centerKey, setCenterKey] = useState(initialCenter ? entityKey(initialCenter) : "VER::旧本");
  const [typeFilter, setTypeFilter] = useState<EntityType | "ALL">("ALL");
  const [limit, setLimit] = useState(20);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [chartVersion, setChartVersion] = useState(0);

  const [centerType, centerName] = centerKey.split("::") as [EntityType, string];
  const center = getEntity(centerType, centerName) ?? initialCenter ?? dataset.entityCatalog[0];
  const allRelated = useMemo(() => getRelatedEntities(center, 80), [center]);
  const related = useMemo(
    () => allRelated
      .filter(({ entry }) => typeFilter === "ALL" || entry.type === typeFilter)
      .slice(0, limit),
    [allRelated, limit, typeFilter],
  );
  const visibleTypes = TYPE_ORDER.filter((type) => allRelated.some(({ entry }) => entry.type === type));
  const selected = selectedKey
    ? related.find(({ entry }) => entityKey(entry) === selectedKey) ?? null
    : null;

  const option = useMemo(
    () => buildNetworkOption(center, related, selectedKey),
    [center, related, selectedKey],
  );

  function chooseCenter(type: EntityType, name: string) {
    setCenterKey(`${type}::${name}`);
    setTypeFilter("ALL");
    setSelectedKey(null);
    setChartVersion((value) => value + 1);
  }

  function resetView() {
    setTypeFilter("ALL");
    setLimit(20);
    setSelectedKey(null);
    setChartVersion((value) => value + 1);
  }

  return (
    <div className={embedded ? "" : "site-container py-8 md:py-12"}>
      {!embedded && <header className="border-y border-[var(--line-dark)] py-6 md:flex md:items-end md:justify-between md:gap-8">
        <div>
          <p className="text-[10px] tracking-[.18em] text-[var(--purple)]">EXPERIMENT · ENTITY CO-OCCURRENCE</p>
          <h1 className="mt-3 text-[34px] font-normal leading-tight md:text-[46px]">实体共现网络</h1>
          <p className="mt-3 max-w-[760px] text-[13px] leading-7 text-[var(--muted)]">
            以当前实体为中心，展示与其共同出现于同一封书信的相关实体；连线粗细表示共同涉及的书信数量。
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 md:mt-0">
          {SAMPLE_ENTITIES.map((item) => {
            const active = centerType === item.type && center.canonical === item.name;
            return <button key={`${item.type}-${item.name}`} type="button" className={`border px-4 py-2 text-[12px] ${active ? "border-[#397565] bg-[#e2eee8] text-[#2d6758]" : "border-[var(--line)] bg-transparent"}`} onClick={() => chooseCenter(item.type, item.name)}>{item.name}</button>;
          })}
        </div>
      </header>}

      <section className={`${embedded ? "" : "mt-6"} border border-[var(--line)] bg-[var(--surface)]`}>
        <header className="grid gap-4 border-b border-[var(--line)] px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-[23px] font-normal">{embedded ? "相关实体" : `以“${center.canonical}”为中心`}</h2>
            <span className="text-[11px] text-[var(--muted)]">{embedded ? `以“${center.canonical}”为中心 · ` : ""}{entityTypeMeta[center.type].label} · 出现{center.count}次 · 涉及{center.letterIds.length}封</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="mr-1 text-[var(--muted)]">显示</span>
            {[8, 12, 20].map((value) => <button key={value} type="button" className={`border px-3 py-1.5 ${limit === value ? "border-[#397565] bg-[#e2eee8] text-[#2d6758]" : "border-[var(--line)]"}`} onClick={() => { setLimit(value); setSelectedKey(null); }}>{value}项</button>)}
            <button type="button" className="ml-1 border-b border-[#397565] px-1 py-1.5 text-[#397565]" onClick={resetView}>重置视图</button>
          </div>
        </header>

        <div className="grid min-h-[570px] lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 border-b border-[var(--line)] lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap gap-x-4 gap-y-2 px-5 pt-4 text-[11px]">
              <button type="button" className={typeFilter === "ALL" ? "text-[#397565] underline underline-offset-4" : "text-[var(--muted)]"} onClick={() => { setTypeFilter("ALL"); setSelectedKey(null); }}>全部类型</button>
              {visibleTypes.map((type) => <button key={type} type="button" className={`flex items-center gap-1.5 ${typeFilter === type ? "text-[#397565] underline underline-offset-4" : "text-[var(--muted)]"}`} onClick={() => { setTypeFilter(type); setSelectedKey(null); }}><i className="h-2 w-2 rounded-full" style={{ background: annotationStyles.entity[type].color }} />{entityTypeMeta[type].label}</button>)}
            </div>
            <div className="h-[500px] w-full">
              <ReactEChartsCore
                key={`${centerKey}-${chartVersion}`}
                echarts={echarts}
                option={option}
                style={{ width: "100%", height: "100%" }}
                notMerge
                opts={{ renderer: "canvas" }}
                onEvents={{
                  click: (params: { dataType?: string; data?: { role?: string; key?: string } }) => {
                    const key = params.data?.key;
                    if (params.dataType === "node" && params.data?.role === "related" && key) {
                      setSelectedKey((current) => current === key ? null : key);
                    }
                  },
                }}
              />
            </div>
          </div>

          <aside className="flex min-h-[250px] flex-col p-6">
            <p className="text-[10px] tracking-[.14em] text-[var(--purple)]">SELECTED RELATION</p>
            {selected ? <SelectedRelation center={center} related={selected} /> : (
              <div className="my-auto">
                <h3 className="text-[22px] font-normal">选择一个相关实体</h3>
                <p className="mt-3 text-[12px] leading-7 text-[var(--muted)]">点击外围节点后，在这里查看实体类型、共现书信数以及详情入口。</p>
              </div>
            )}
            <p className="mt-auto border-t border-[var(--line)] pt-4 text-[10px] leading-5 text-[var(--muted)]">共现表示两个实体出现在同一封书信中，不直接等同于真实社会关系。</p>
          </aside>
        </div>
      </section>
    </div>
  );
}

function SelectedRelation({ center, related }: { center: EntityCatalogEntry; related: RelatedNode }) {
  return (
    <div className="mt-7">
      <span className="text-[11px] text-[var(--muted)]">{entityTypeMeta[related.entry.type].label} · {related.entry.type}</span>
      <h3 className="mt-2 text-[30px] font-normal">{related.entry.canonical}</h3>
      <div className="mt-6 border-y border-[var(--line)] py-4">
        <strong className="text-[27px] font-normal">{related.sharedLetters}</strong><span className="ml-2 text-[12px] text-[var(--muted)]">封共同书信</span>
        <p className="mt-2 text-[11px] text-[var(--muted)]">与“{center.canonical}”共同出现</p>
      </div>
      <Link className="mt-6 inline-block border-b border-[var(--purple)] pb-1 text-[12px] text-[var(--purple)]" href={`/entity/${related.entry.type}/${encodeURIComponent(related.entry.canonical)}`}>查看实体详情 ↗</Link>
    </div>
  );
}

function buildNetworkOption(center: EntityCatalogEntry, related: RelatedNode[], selectedKey: string | null) {
  const maxShared = Math.max(...related.map((item) => item.sharedLetters), 1);
  const categories = TYPE_ORDER.map((type) => ({ name: entityTypeMeta[type].label, itemStyle: { color: annotationStyles.entity[type].color } }));
  const nodes = [
    {
      id: "center",
      key: entityKey(center),
      role: "center",
      name: center.canonical,
      value: center.letterIds.length,
      symbolSize: 72,
      category: TYPE_ORDER.indexOf(center.type),
      fixed: true,
      x: 0,
      y: 0,
      label: { show: true, position: "inside", color: "#fff", fontSize: 15, fontWeight: 600 },
      itemStyle: { color: annotationStyles.entity[center.type].color, borderColor: "#fffef9", borderWidth: 4, shadowBlur: 15, shadowColor: "rgba(39,36,42,.18)" },
    },
    ...related.map(({ entry, sharedLetters }, index) => {
      const key = entityKey(entry);
      const isSelected = key === selectedKey;
      const isDimmed = Boolean(selectedKey && !isSelected);
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(related.length, 1);
      const radius = related.length > 12 ? (index % 2 === 0 ? 190 : 265) : 225;
      const x = Math.cos(angle) * radius * 1.28;
      const y = Math.sin(angle) * radius;
      const labelPosition = Math.cos(angle) > .35
        ? "right"
        : Math.cos(angle) < -.35
          ? "left"
          : Math.sin(angle) > 0
            ? "bottom"
            : "top";
      return {
        id: key,
        key,
        role: "related",
        name: entry.canonical,
        value: sharedLetters,
        sharedLetters,
        entityType: entry.type,
        x,
        y,
        symbolSize: 25 + Math.sqrt(sharedLetters / maxShared) * 19,
        category: TYPE_ORDER.indexOf(entry.type),
        label: isSelected ? {
          show: true,
          position: labelPosition,
          distance: 10,
          formatter: `{name|${entry.canonical}}\n{meta|共现 ${sharedLetters} 封}`,
          backgroundColor: "rgba(255,254,249,.96)",
          borderColor: "#b8c8c1",
          borderWidth: 1,
          padding: [7, 9],
          rich: {
            name: { color: "#2c292d", fontSize: 12, fontWeight: 600, lineHeight: 19 },
            meta: { color: "#397565", fontSize: 10, lineHeight: 16 },
          },
        } : {
          show: true,
          position: labelPosition,
          distance: 7,
          color: "#403c40",
          opacity: isDimmed ? .14 : 1,
          fontSize: 11,
          width: 76,
          overflow: "truncate",
        },
        itemStyle: {
          color: annotationStyles.entity[entry.type].color,
          opacity: isDimmed ? .16 : 1,
          borderColor: isSelected ? "#2a6354" : "#fffef9",
          borderWidth: isSelected ? 4 : 2,
          shadowBlur: isSelected ? 14 : 0,
          shadowColor: isSelected ? "rgba(42,99,84,.2)" : "transparent",
        },
      };
    }),
  ];
  const links = related.map(({ entry, sharedLetters }) => ({
    source: "center",
    target: entityKey(entry),
    value: sharedLetters,
    lineStyle: {
      width: 1 + Math.log2(sharedLetters + 1) * 1.2,
      color: entityKey(entry) === selectedKey ? "#397565" : "#8aa39a",
      opacity: selectedKey ? (entityKey(entry) === selectedKey ? .92 : .07) : .42,
      curveness: .04,
    },
  }));

  return {
    animationDuration: 600,
    textStyle: { fontFamily: '"Noto Serif SC", "Songti SC", serif' },
    tooltip: {
      trigger: "item",
      backgroundColor: "#fffef9",
      borderColor: "#d8d1c6",
      textStyle: { color: "#2c292d", fontSize: 12 },
      formatter: (params: { dataType?: string; data?: { role?: string; name?: string; sharedLetters?: number; entityType?: EntityType } }) => {
        const data = params.data;
        if (!data || params.dataType !== "node") return "";
        if (data.role === "center") return `<b>${data.name ?? ""}</b><br/>当前中心实体`;
        const type = data.entityType ? entityTypeMeta[data.entityType].label : "实体";
        return `<b>${data.name ?? ""}</b><br/>${type}<br/>与中心实体共现 ${data.sharedLetters ?? 0} 封`;
      },
    },
    series: [{
      type: "graph",
      layout: "force",
      roam: true,
      draggable: true,
      data: nodes,
      links,
      categories,
      force: {
        repulsion: 430,
        edgeLength: [115, 205],
        gravity: .07,
        friction: .65,
        layoutAnimation: true,
      },
      emphasis: selectedKey
        ? { disabled: true }
        : { focus: "adjacency", lineStyle: { opacity: .85 } },
      blur: { itemStyle: { opacity: .22 }, lineStyle: { opacity: .08 }, label: { opacity: .28 } },
      select: { itemStyle: { borderColor: "#2a6354", borderWidth: 4 } },
    }],
  };
}

function entityKey(entry: EntityCatalogEntry) {
  return `${entry.type}::${entry.canonical}`;
}
