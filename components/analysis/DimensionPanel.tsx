"use client";

import { useMemo } from "react";
import { actTypeMeta, entityTypeMeta, eventTypeMeta } from "@/lib/config";
import { CHART_TYPES, getChartIncompatibilityReason, METRICS } from "@/lib/analysis/dimensions";
import { getSecondaryCategories } from "@/lib/topic-config";
import type { EntityType } from "@/lib/types";
import type {
  AnalysisConfig,
  DimensionKey,
  Filter,
  MetricId,
  ChartType,
} from "@/lib/analysis/types";
import { FilterRow } from "./FilterRow";
import type { SecondaryCategory } from "@/lib/topic-config";

interface DimensionPanelProps {
  config: AnalysisConfig;
  onChange: (config: AnalysisConfig) => void;
  onAnalyze: () => void;
  unknownYearCount: number;
  cacheEpoch: number;
}

let filterIdCounter = 0;

const fieldClass =
  "h-[52px] w-full border border-[var(--line-dark)] bg-[var(--surface)] px-3 font-serif text-[16px] text-[var(--ink)] outline-none transition focus:border-[var(--purple)] focus-visible:ring-1 focus-visible:ring-[var(--purple)] disabled:cursor-not-allowed disabled:opacity-55";

// ── Layers ───────────────────────────────────────────────────

const LAYERS = [
  { id: "entity" as const, label: "实体" },
  { id: "event" as const, label: "事件" },
  { id: "act" as const, label: "行为" },
] as const;

type LayerId = (typeof LAYERS)[number]["id"];

// ── Type options per layer ───────────────────────────────────

interface TypeOption {
  key: DimensionKey;
  label: string;
  entityCode?: EntityType;
}

const ENTITY_TYPE_OPTIONS: TypeOption[] = Object.entries(entityTypeMeta).map(
  ([type, meta]) => ({
    key: ("entity_type:" + type) as DimensionKey,
    label: meta.label,
    entityCode: type as EntityType,
  }),
);

const EVENT_TYPE_OPTIONS: TypeOption[] = [
  { key: "event_type:" as DimensionKey, label: "全部事件" },
  ...Object.entries(eventTypeMeta).map(
    ([type, meta]) => ({
      key: ("event_type:" + type) as DimensionKey,
      label: meta.label,
    }),
  ),
];

const ACT_TYPE_OPTIONS: TypeOption[] = [
  { key: "act_type:" as DimensionKey, label: "全部行为" },
  ...Object.entries(actTypeMeta).map(
    ([type, meta]) => ({
      key: ("act_type:" + type) as DimensionKey,
      label: meta.label,
    }),
  ),
];

function typeOptionsForLayer(layer: LayerId): TypeOption[] {
  if (layer === "entity") return ENTITY_TYPE_OPTIONS;
  if (layer === "event") return EVENT_TYPE_OPTIONS;
  return ACT_TYPE_OPTIONS;
}

// ── Group by options ─────────────────────────────────────────

interface GroupByOption {
  key: DimensionKey | null;
  label: string;
}

const GROUP_BY_OPTIONS: GroupByOption[] = [
  { key: "year", label: "年份" },
  { key: "period", label: "时期（晚清 / 民初）" },
  { key: "recipient", label: "收信人" },
  { key: null, label: "不分组（总计）" },
];

// ── Metric compatibility ─────────────────────────────────────

const ENTITY_METRICS: MetricId[] = ["mention_count", "canonical_count", "letter_count"];
const EVENT_METRICS: MetricId[] = ["event_count", "letter_count"];
const ACT_METRICS: MetricId[] = ["paragraph_count", "letter_count"];

function compatibleMetrics(layer: LayerId): MetricId[] {
  if (layer === "entity") return ENTITY_METRICS;
  if (layer === "event") return EVENT_METRICS;
  return ACT_METRICS;
}

function defaultMetricForLayer(layer: LayerId): MetricId {
  if (layer === "entity") return "mention_count";
  if (layer === "event") return "event_count";
  return "paragraph_count";
}

// ── Config parsing ──────────────────────────────────────────

function layerFromTypeKey(key: DimensionKey | null): LayerId | null {
  if (!key) return null;
  if (key.startsWith("entity_type:")) return "entity";
  if (key.startsWith("event_type:")) return "event";
  if (key.startsWith("act_type:")) return "act";
  return null;
}

function parseConfig(config: AnalysisConfig): {
  layer: LayerId | null;
  typeKey: DimensionKey | null;
  entityCode: EntityType | null;
  selectedSubtypes: string[];
  groupByKey: DimensionKey | null;
} {
  const typeKey = config.rowKey;
  const layer = layerFromTypeKey(typeKey);

  let entityCode: EntityType | null = null;
  if (layer === "entity" && typeKey) {
    const opt = ENTITY_TYPE_OPTIONS.find(function (o) { return o.key === typeKey; });
    entityCode = opt?.entityCode ?? null;
  }

  const selectedSubtypes: string[] = [];
  for (var i = 0; i < config.selectedDimensions.length; i++) {
    var dim = config.selectedDimensions[i];
    if (dim.startsWith("entity_subtype:")) {
      selectedSubtypes.push(dim.replace("entity_subtype:", ""));
    }
  }

  var groupByKey: DimensionKey | null = null;
  if (config.columnKey && GROUP_BY_OPTIONS.some(function (g) { return g.key === config.columnKey; })) {
    groupByKey = config.columnKey;
  }

  return { layer: layer, typeKey: typeKey, entityCode: entityCode, selectedSubtypes: selectedSubtypes, groupByKey: groupByKey };
}

// ── Chip / tab classes ──────────────────────────────────────

var CHIP_SELECTED = "inline-flex min-h-9 max-w-full cursor-pointer items-center gap-2 border px-3 py-1.5 font-serif text-[12px] leading-5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)] active:translate-y-px border-[var(--purple)] bg-[var(--purple-pale)] text-[var(--purple-deep)]";
var CHIP_NORMAL = "inline-flex min-h-9 max-w-full cursor-pointer items-center gap-2 border px-3 py-1.5 font-serif text-[12px] leading-5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)] active:translate-y-px border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--line-dark)] hover:bg-[rgba(255,254,249,.72)]";

function chipClass(selected: boolean): string {
  return selected ? CHIP_SELECTED : CHIP_NORMAL;
}

var TAB_SELECTED = "inline-flex h-[48px] cursor-pointer items-center justify-center border px-6 font-serif text-[15px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)] border-[var(--purple)] bg-[var(--purple-pale)] text-[var(--purple-deep)] font-medium";
var TAB_NORMAL = "inline-flex h-[48px] cursor-pointer items-center justify-center border px-6 font-serif text-[15px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)] border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--line-dark)] hover:text-[var(--ink)]";

function tabClass(selected: boolean): string {
  return selected ? TAB_SELECTED : TAB_NORMAL;
}

// ── Labels ──────────────────────────────────────────────────

function typeLabel(key: DimensionKey | null): string {
  if (!key) return "";
  var allOpts = ENTITY_TYPE_OPTIONS.concat(EVENT_TYPE_OPTIONS).concat(ACT_TYPE_OPTIONS);
  for (var i = 0; i < allOpts.length; i++) {
    if (allOpts[i].key === key) return allOpts[i].label;
  }
  return key;
}

function groupLabel(key: DimensionKey | null): string {
  if (!key) return "不分组";
  for (var i = 0; i < GROUP_BY_OPTIONS.length; i++) {
    if (GROUP_BY_OPTIONS[i].key === key) return GROUP_BY_OPTIONS[i].label;
  }
  return key;
}

function subtypeCode(entityCode: EntityType, category: SecondaryCategory): string {
  var prefix = entityCode + "-";
  return category.code.startsWith(prefix)
    ? category.code
    : prefix + category.code;
}

// ── Component ───────────────────────────────────────────────

export function DimensionPanel({
  config,
  onChange,
  onAnalyze,
  unknownYearCount,
}: DimensionPanelProps) {
  var parsed = parseConfig(config);
  var layer = parsed.layer;
  var typeKey = parsed.typeKey;
  var entityCode = parsed.entityCode;
  var selectedSubtypes = parsed.selectedSubtypes;
  var groupByKey = parsed.groupByKey;

  var subtypes = useMemo(
    function () { return entityCode ? getSecondaryCategories(entityCode) : []; },
    [entityCode],
  );

  var normalizedSubtypes = useMemo(
    function () {
      return entityCode
        ? subtypes.map(function (cat) { return subtypeCode(entityCode!, cat); })
        : [];
    },
    [entityCode, subtypes],
  );

  var hasAnySubtypeSelected = normalizedSubtypes.some(function (code) {
    return selectedSubtypes.includes(code);
  });

  // ── buildConfig helper ────────────────────────────────────

  function buildConfig(
    patch: Partial<AnalysisConfig>,
    newLayer: LayerId | null,
    newTypeKey: DimensionKey | null,
    newSubtypes: string[],
    newGroupBy: DimensionKey | null,
  ): AnalysisConfig {
    var dims: DimensionKey[] = [];
    if (newTypeKey) dims.push(newTypeKey);
    for (var i = 0; i < newSubtypes.length; i++) {
      dims.push(("entity_subtype:" + newSubtypes[i]) as DimensionKey);
    }
    if (newGroupBy) dims.push(newGroupBy);

    var metric = patch.metric ?? config.metric;
    if (newLayer && !compatibleMetrics(newLayer).includes(metric)) {
      metric = defaultMetricForLayer(newLayer);
    }

    var chartType = patch.chartType ?? config.chartType;
    if (!patch.chartType) {
      if (newGroupBy === "year" || newGroupBy === "period") {
        chartType = "line";
      } else if (newGroupBy === "recipient") {
        chartType = "bar_stacked";
      } else if (newGroupBy === null && newTypeKey) {
        chartType = "pie_ring";
      }
    }

    var result: AnalysisConfig = Object.assign({}, config, patch, {
      selectedDimensions: dims,
      rowKey: newTypeKey,
      columnKey: newGroupBy,
      metric: metric,
      chartType: chartType,
    });
    return result;
  }

  // ── handlers ──────────────────────────────────────────────

  var handleLayerChange = function (newLayer: LayerId) {
    var types = typeOptionsForLayer(newLayer);
    var newTypeKey = types[0]?.key ?? null;
    onChange(buildConfig({}, newLayer, newTypeKey, [], groupByKey));
  };

  var handleTypeChange = function (option: TypeOption) {
    var newLayer = layerFromTypeKey(option.key);
    onChange(buildConfig({}, newLayer, option.key, [], groupByKey));
  };

  var handleToggleSubtype = function (code: string) {
    var newSubtypes = selectedSubtypes.includes(code)
      ? selectedSubtypes.filter(function (s) { return s !== code; })
      : selectedSubtypes.concat([code]);
    onChange(buildConfig({}, layer, typeKey, newSubtypes, groupByKey));
  };

  var handleSelectAllSubtypes = function () {
    onChange(buildConfig({}, layer, typeKey, [], groupByKey));
  };

  var handleGroupByChange = function (opt: GroupByOption) {
    onChange(buildConfig({}, layer, typeKey, selectedSubtypes, opt.key));
  };

  var handleMetricChange = function (metric: MetricId) {
    onChange(buildConfig({ metric: metric }, layer, typeKey, selectedSubtypes, groupByKey));
  };

  // ── filters ───────────────────────────────────────────────

  var update = function (patch: Partial<AnalysisConfig>) {
    onChange(Object.assign({}, config, patch));
  };

  var handleAddFilter = function () {
    filterIdCounter += 1;
    var filter: Filter = {
      id: "filter_" + Date.now() + "_" + filterIdCounter,
      dimension: "recipient",
      operator: "equals",
      value: "",
    };
    update({ filters: config.filters.concat([filter]) });
  };

  var handleUpdateFilter = function (updated: Filter) {
    update({
      filters: config.filters.map(function (f) { return f.id === updated.id ? updated : f; }),
    });
  };

  var handleRemoveFilter = function (id: string) {
    update({ filters: config.filters.filter(function (f) { return f.id !== id; }) });
  };

  // ── Analysis statement ────────────────────────────────────

  var metricLabel =
    METRICS.find(function (m) { return m.id === config.metric; })?.label ?? "";

  var subtypeHint = "";
  if (hasAnySubtypeSelected && normalizedSubtypes.length > 0) {
    subtypeHint = "（限定：" +
      subtypes
        .filter(function (cat) {
          return selectedSubtypes.includes(subtypeCode(entityCode!, cat));
        })
        .map(function (cat) { return cat.label; })
        .join("、") +
      "）";
  }

  var statement = typeKey
    ? "「" + typeLabel(typeKey) + "」" + subtypeHint + "按「" + groupLabel(groupByKey) + "」的" + metricLabel
    : "请先选择标注层和具体类型";

  // ── render ────────────────────────────────────────────────

  var currentTypes = layer ? typeOptionsForLayer(layer) : [];

  function renderCheck(show: boolean) {
    if (!show) return null;
    return (
      <span
        aria-hidden="true"
        className="text-[12px] font-semibold text-[var(--purple)]"
      >
        {"✓"}
      </span>
    );
  }

  return (
    <section className="font-serif text-[var(--ink)]">
      <div className="space-y-[24px]">
        <h2 className="text-[20px] font-semibold tracking-[.04em] text-[var(--ink)] sm:text-[22px]">
          {"选择分析对象"}
        </h2>

        {/* Step 1: Layer */}
        <div className="grid gap-3 sm:grid-cols-[108px_minmax(0,1fr)] sm:items-center">
          <h3 className="text-[15px] font-medium text-[var(--purple-deep)]">
            {"对象层级"}
          </h3>
          <div className="flex gap-0">
            {LAYERS.map(function (l) {
              var sel = layer === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={function () { handleLayerChange(l.id); }}
                  className={tabClass(sel) + " first:rounded-l last:rounded-r"}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Type */}
        {layer && (
          <div className="grid gap-3 sm:grid-cols-[108px_minmax(0,1fr)] sm:items-start">
            <h3 className="pt-1.5 text-[15px] font-medium text-[var(--purple-deep)]">
              {"对象类型"}
            </h3>
            <div className="flex min-w-0 flex-wrap gap-2.5">
              {currentTypes.map(function (opt) {
                var sel = typeKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={function () { handleTypeChange(opt); }}
                    className={chipClass(sel)}
                  >
                    {renderCheck(sel)}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Subtypes (entity layer only) */}
        {layer === "entity" && typeKey && subtypes.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-[108px_minmax(0,1fr)] sm:items-start">
            <div>
              <h3 className="pt-1.5 text-[15px] font-medium text-[var(--purple-deep)]">
                {"细分范围"}
              </h3>
              <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
                {"可选；未选时包含全部"}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSelectAllSubtypes}
                className={chipClass(!hasAnySubtypeSelected)}
              >
                {renderCheck(!hasAnySubtypeSelected)}
                {"全部"}
              </button>
              {subtypes.map(function (cat) {
                var code = subtypeCode(entityCode!, cat);
                var sel = selectedSubtypes.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={function () { handleToggleSubtype(code); }}
                    className={chipClass(sel)}
                  >
                    {renderCheck(sel)}
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: GroupBy + Metric */}
        <div className="grid gap-4 border border-[var(--line)] bg-[rgba(240,236,226,.46)] p-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[20px] leading-6 text-[var(--ink)]">
              {"横向维度"}
            </span>
            <span className="mb-2 block text-[15px] leading-5 text-[var(--muted)]">
              {"按时间或人物展开"}
            </span>
            <select
              value={groupByKey ?? ""}
              onChange={function (e) {
                var val = e.target.value;
                var opt = GROUP_BY_OPTIONS.find(function (o) { return (o.key ?? "") === val; });
                if (opt) handleGroupByChange(opt);
              }}
              className={fieldClass}
            >
              {GROUP_BY_OPTIONS.map(function (opt) {
                return (
                  <option key={opt.key ?? "__none__"} value={opt.key ?? ""}>
                    {opt.label}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[20px] leading-6 text-[var(--ink)]">
              {"纵向维度"}
            </span>
            <span className="mb-2 block text-[15px] leading-5 text-[var(--muted)]">
              {"选择统计口径"}
            </span>
            <select
              value={config.metric}
              onChange={function (e) { handleMetricChange(e.target.value as MetricId); }}
              disabled={!layer}
              className={fieldClass}
            >
              {layer
                ? compatibleMetrics(layer).map(function (mId) {
                    var m = METRICS.find(function (metric) { return metric.id === mId; });
                    return m ? (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ) : null;
                  })
                : METRICS.map(function (m) {
                    return (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    );
                  })}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[20px] leading-6 text-[var(--ink)]">
              {"图表类型"}
            </span>
            <span className="mb-2 block text-[15px] leading-5 text-[var(--muted)]">
              {"选择结果的呈现方式"}
            </span>
            <select
              value={config.chartType}
              onChange={function (e) { update({ chartType: e.target.value as ChartType }); }}
              className={fieldClass}
            >
              {CHART_TYPES.map(function (chartType) {
                var reason = getChartIncompatibilityReason(chartType.id, typeKey, groupByKey);
                return (
                  <option key={chartType.id} value={chartType.id} disabled={Boolean(reason)}>
                    {chartType.label}{reason ? "（" + reason + "）" : ""}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        {/* Analysis statement preview */}
        <div className="border border-dashed border-[var(--line)] px-4 py-3 text-center">
          <span className="text-[9px] font-semibold tracking-[.16em] text-[var(--purple)]">
            {"当前分析"}
          </span>
          <p className="mt-1 font-serif text-[16px] text-[var(--ink)]">
            {statement}
          </p>
        </div>

        {/* Filters */}
        <section aria-labelledby="filter-heading" className="pt-2">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h2
                id="filter-heading"
                className="text-[17px] font-semibold tracking-[.04em] text-[var(--ink)]"
              >
                {"筛选条件"}
              </h2>
              <p className="mt-1 text-[15px] leading-6 text-[var(--muted)]">
                {"可选，多条条件按“且”关系应用"}
              </p>
            </div>
            <span className="text-[15px] text-[#9a949a]">
              {config.filters.length + " 条"}
            </span>
          </div>

          {config.filters.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {config.filters.map(function (filter) {
                return (
                  <FilterRow
                    key={filter.id}
                    filter={filter}
                    onUpdate={handleUpdateFilter}
                    onRemove={handleRemoveFilter}
                  />
                );
              })}
            </div>
          ) : (
            <p className="border border-dashed border-[var(--line)] px-3 py-3 text-center text-[15px] text-[#9a949a]">
              {"当前显示全部数据"}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleAddFilter}
              className="border border-[var(--line-dark)] bg-transparent px-3 py-2 text-[15px] font-serif text-[var(--purple)] transition hover:border-[var(--purple)] hover:bg-[var(--purple-pale)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)]"
            >
              {"＋ 添加筛选"}
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-[15px] text-[var(--ink)]">
              <input
                type="checkbox"
                checked={config.excludeUnknownYear}
                onChange={function (e) {
                  update({ excludeUnknownYear: e.target.checked });
                }}
                className="size-4 accent-[var(--purple)]"
              />
              {"排除无年份书信（" + unknownYearCount + " 封）"}
            </label>
          </div>
        </section>

        {/* Start button */}
        <div className="flex flex-col items-start justify-between gap-3 pt-2 sm:flex-row sm:items-center">
          <p className="text-[15px] leading-6 text-[var(--muted)]" aria-live="polite">
            {typeKey
              ? "已就绪，点击右侧按钮生成分析"
              : "请先选择标注层和具体类型"}
          </p>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!typeKey}
            className="h-[52px] w-full bg-[var(--purple)] px-7 text-[16px] font-serif font-medium text-white transition hover:bg-[var(--purple-deep)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)] disabled:cursor-not-allowed disabled:bg-[#b7b1bd] disabled:text-white sm:w-auto"
          >
            <span className="text-white">{"生成分析"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
