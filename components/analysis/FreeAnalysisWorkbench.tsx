"use client";

import { useMemo, useState } from "react";
import rawAnalysisData from "@/data/free-analysis.json";

type SubjectLayer = "entity" | "event" | "action" | "letters";
type Granularity = "type" | "subtype" | "entity";
type DimensionId = "event" | "action" | "time" | "entity" | "letter";
type MetricId = "letters" | "mentions" | "events" | "coverage" | "share" | "association" | "cooccurrence";
type NormalizeId = "raw" | "per100" | "withinGroup" | "baseline";
type ChartId = "bar" | "dot" | "grouped" | "stacked" | "heatmap" | "line" | "columns" | "smallMultiples" | "network" | "lollipop";
type DimensionMode = "all" | "compare" | "filter";
type SubjectMode = "merge" | "compare" | "cooccur";

type Option<T extends string> = { id: T; label: string; note: string };
type CompactEntityValue = { count: number; subtype: string };
type CompactLetter = {
  id: string;
  number: string;
  year: string | null;
  recipient: string;
  entities: Record<string, Record<string, CompactEntityValue>>;
  events: Record<string, number>;
  actions: Record<string, number>;
};
type CompactData = {
  generatedAt: string;
  sourceTotals: { letters: number; entityMentions: number; events: number; actions: number; canonicalEntities: number };
  events: string[];
  actions: string[];
  entityOptions: Record<string, { name: string; count: number; subtypes: string[] }[]>;
  letters: CompactLetter[];
};

const analysisData = rawAnalysisData as unknown as CompactData;
const realLetters = analysisData.letters;

type AnalysisConfig = {
  layer: SubjectLayer;
  entityType: string;
  entityTypes: string[];
  granularity: Granularity;
  selections: string[];
  subjectMode: SubjectMode;
  subjectLabel: string;
  sourceDimension: DimensionId;
  dimensionMode: DimensionMode;
  dimensionValues: string[];
  dimension: DimensionId;
  metric: MetricId;
  normalization: NormalizeId;
  isComparison: boolean;
  comparisonLabel: string;
  eventScope: string[];
  actionScope: string[];
  letterScope: string[];
  period: string;
  minFrequency: number;
  topN: number;
  excludeUnknown: boolean;
  analysisType: string;
  estimatedSample: number;
  conditionLabels: string[];
  blockingReason: string;
  warnings: string[];
};

const events = analysisData.events;
const actions = analysisData.actions;
const periods = ["全部年代", "1895 年以前", "1896—1900", "1901—1905", "1906—1910", "1911 年以后"];
const letterGroups = ["书信 001—050", "书信 051—100", "书信 101—200", "书信 201—306"];
const knownYears = realLetters
  .map((letter) => letter.year)
  .filter((year) => year !== null && year !== undefined && /^\d{4}$/.test(String(year)))
  .map((year) => Number(year));
const continuousYears = Array.from(
  { length: Math.max(...knownYears) - Math.min(...knownYears) + 1 },
  (_, index) => `${Math.min(...knownYears) + index}年`,
);

const entityTypes = ["人物", "地点", "书籍", "版本", "时间", "官职", "机构", "亲属", "星命"];

const entitySubtypeOrder: Record<string, string[]> = {
  人物: ["叶德辉本人", "收信人", "同时代人", "叶氏家族", "日本人士", "历史人物", "待考"],
  地点: ["国家", "省／省级", "府／州／县级", "城市", "街道／具体地点", "地区／模糊区域", "山岳", "水体", "设施／建筑"],
  书籍: ["经部", "史部", "子部", "集部", "今人著作", "工具书", "先祖著作"],
  版本: ["宋本／宋刻", "元本／元刻", "明本／明刻", "清本／清刻", "刻本／刊本", "抄本／稿本／写本", "活字本／排印本", "拓本／碑帖", "影印本／石印本", "版本状态", "和刻本"],
  时间: ["相对时间", "绝对时间", "时段／频率", "历史时期"],
  官职: ["中央文官", "地方官", "武职", "学官／文教", "民国新职", "外交／涉外"],
  机构: ["出版／书店", "图书馆／藏书机构", "学校／书院", "政府／衙门", "政党／派系", "公司／银行", "书斋／堂号"],
  亲属: ["祖先／先世", "子孙／后嗣", "父系／宗族", "姻亲／婚姻", "家族合称"],
  星命: ["五行／干支", "星宿／星次", "命理／八字", "易学／占卜", "杂占／风水"],
};

const entitySubtypes: Record<string, string[]> = Object.fromEntries(
  entityTypes.map((type) => {
    const available = new Set(analysisData.entityOptions[type]?.flatMap((entry) => entry.subtypes) ?? []);
    return [type, entitySubtypeOrder[type].filter((subtype) => available.has(subtype))];
  }),
);

const entityOptions: Record<string, string[]> = Object.fromEntries(
  Object.entries(analysisData.entityOptions).map(([type, entries]) => [type, entries.map((entry) => entry.name)]),
);

const entitySubtypeAssignments: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(analysisData.entityOptions).map(([type, entries]) => [type, Object.fromEntries(entries.map((entry) => [entry.name, entry.subtypes[0] ?? "未分类"]))]),
);

const layers: Option<SubjectLayer>[] = [
  { id: "entity", label: "实体", note: "可按小类或具体实体分析" },
  { id: "event", label: "事件", note: "五类事件或指定事件" },
  { id: "action", label: "行动", note: "四类行动及其子类" },
  { id: "letters", label: "书信集合", note: "全部、时期或自选书信" },
];

const dimensionOptions: Option<DimensionId>[] = [
  { id: "event", label: "事件类型", note: "在哪类事件中出现" },
  { id: "action", label: "行动类型", note: "在句中如何推进事务" },
  { id: "time", label: "时间", note: "按年份连续观察变化" },
  { id: "entity", label: "内部实体", note: "查看集合中的具体对象" },
];

const metricOptions: Option<MetricId>[] = [
  { id: "letters", label: "涉及书信数", note: "同一封信重复出现只计一次" },
  { id: "mentions", label: "原文提及次数", note: "每次标注均计入" },
  { id: "events", label: "关联事件数", note: "按事件标注片段计算" },
  { id: "coverage", label: "材料覆盖率", note: "涉及书信占当前范围的比例" },
  { id: "share", label: "组内构成比例", note: "适合比较规模不同的对象组" },
  { id: "association", label: "相对关联强度", note: "与全体基线比较突出程度" },
  { id: "cooccurrence", label: "共同出现次数", note: "只表示材料共现，不等于真实关系" },
];

const chartCatalog: Record<ChartId, { label: string; note: string }> = {
  bar: { label: "横向条形图", note: "比较少量分类的绝对大小" },
  dot: { label: "并列点图", note: "紧凑比较多个对象或小类" },
  grouped: { label: "分组条形图", note: "比较多个对象的同一指标" },
  stacked: { label: "100% 堆积图", note: "比较规模不同组的内部构成" },
  heatmap: { label: "圆角矩形热力图", note: "比较两个分类维度" },
  line: { label: "时间趋势图", note: "观察连续时间变化" },
  columns: { label: "阶段柱状图", note: "适合时间稀疏的材料" },
  smallMultiples: { label: "小多图", note: "同时比较多个对象组" },
  network: { label: "中心关系网络", note: "观察少量共现对象" },
  lollipop: { label: "棒棒糖排行", note: "查看带条件的内部实体排行" },
};

export function FreeAnalysisWorkbench() {
  const [layer, setLayer] = useState<SubjectLayer>("entity");
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>(["人物"]);
  const entityType = selectedEntityTypes[0] ?? "人物";
  const [granularity, setGranularity] = useState<Granularity>("type");
  const [selectedSubtypes, setSelectedSubtypes] = useState<string[]>([encodeSubtype("人物", "同时代人")]);
  const [selectedEntities, setSelectedEntities] = useState<string[]>([encodeEntity("人物", "张元济")]);
  const [entitySubtypeFilter, setEntitySubtypeFilter] = useState("全部小类");
  const [entityQuery, setEntityQuery] = useState("");
  const [otherSubjects, setOtherSubjects] = useState<string[]>([events[0]]);
  const [subjectMode, setSubjectMode] = useState<SubjectMode>("compare");
  const [dimension, setDimension] = useState<DimensionId>("event");
  const [dimensionMode, setDimensionMode] = useState<DimensionMode>("all");
  const [dimensionValues, setDimensionValues] = useState<string[]>(events);
  const [secondaryDimension, setSecondaryDimension] = useState<DimensionId>("action");
  const [metricOverride, setMetricOverride] = useState<MetricId | null>(null);
  const [normalizeOverride, setNormalizeOverride] = useState<NormalizeId | null>(null);
  const [eventFilter, setEventFilter] = useState(events);
  const [actionFilter, setActionFilter] = useState(actions);
  const [letterFilter, setLetterFilter] = useState(letterGroups);
  const [period, setPeriod] = useState("全部年代");
  const [minFrequency, setMinFrequency] = useState(2);
  const [topN, setTopN] = useState(10);
  const [excludeUnknown, setExcludeUnknown] = useState(false);
  const [ran, setRan] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [selectedChart, setSelectedChart] = useState<ChartId | null>(null);
  const [openPanel, setOpenPanel] = useState<"subject" | "dimension" | "scope" | "metric">("subject");
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);

  const canUseSubtypes = selectedEntityTypes.every((type) => entitySubtypes[type]?.length > 0);
  const selections = layer === "entity" ? (granularity === "type" ? selectedEntityTypes : granularity === "subtype" ? selectedSubtypes : selectedEntities) : otherSubjects;
  const entityHasMultipleObjects = layer === "entity" && selections.length > 1;
  const isComparison = selections.length > 1 && subjectMode === "compare";
  const subjectComparisonLabel = selections.length > 1 ? (subjectMode === "compare" ? "分别比较所选对象" : subjectMode === "cooccur" ? "同封信共现" : "合并为一个集合") : "不比较";
  const availableDimensions = getAvailableDimensions(layer, selectedEntityTypes);
  const sourceDimension = availableDimensions.some((item) => item.id === dimension) ? dimension : availableDimensions[0].id;
  const categoricalDimension = sourceDimension !== "entity";
  const allowedSecondaryDimensions = getSecondaryDimensions(layer, selectedEntityTypes, sourceDimension);
  const effectiveDimension = dimensionMode === "filter" && categoricalDimension
    ? (allowedSecondaryDimensions.some((item) => item.id === secondaryDimension) ? secondaryDimension : allowedSecondaryDimensions[0]?.id ?? sourceDimension)
    : sourceDimension;
  const metric = metricOverride && metricAllowed(metricOverride, effectiveDimension) ? metricOverride : recommendMetric(effectiveDimension, isComparison);
  const normalization = normalizeOverride ?? recommendNormalization(metric, isComparison, effectiveDimension);
  const sourceValues = getDimensionValues(sourceDimension);
  const selectedDimensionValues = dimensionMode === "all" ? sourceValues : dimensionValues.filter((item) => sourceValues.includes(item));
  const comparisonLabel = dimensionMode === "compare" ? (isComparison ? "对象组 × 分类双重比较" : `比较所选${dimensionLabel(sourceDimension)}`) : subjectComparisonLabel;
  const effectiveEventScope = layer === "event" ? selections.filter((item) => events.includes(item)) : sourceDimension === "event" ? selectedDimensionValues : effectiveDimension === "event" ? events : eventFilter;
  const effectiveActionScope = layer === "action" ? selections.filter((item) => actions.includes(item)) : sourceDimension === "action" ? selectedDimensionValues : effectiveDimension === "action" ? actions : actionFilter;
  const effectivePeriod = sourceDimension === "time" && dimensionMode === "filter" && selectedDimensionValues[0] ? selectedDimensionValues[0] : effectiveDimension === "time" ? "全部年代" : period;
  const effectiveLetterScope = layer === "letters"
    ? (selections.includes("全部书信") ? letterGroups : selections.filter((item) => letterGroups.includes(item)))
    : letterFilter;
  const subjectLabel = buildSubjectLabel({ layer, entityTypes: selectedEntityTypes, granularity, selectedSubtypes, selectedEntities, otherSubjects, subjectMode });
  const analysisType = dimensionMode === "filter" ? `${dimensionLabel(sourceDimension)}限定 × ${dynamicDimensionLabel(effectiveDimension, layer, granularity)}分布` : dimensionMode === "compare" ? `${dimensionLabel(sourceDimension)}定向比较` : deriveAnalysisType(layer, granularity, effectiveDimension, isComparison);
  const estimatedSample = estimateRealSample({ layer, entityType, entityTypes: selectedEntityTypes, granularity, selections, subjectMode, eventScope: effectiveEventScope, actionScope: effectiveActionScope, period: effectivePeriod, letterScope: effectiveLetterScope, excludeUnknown });
  const modeError = getDimensionModeError(categoricalDimension, dimensionMode, selectedDimensionValues, allowedSecondaryDimensions) || (sourceDimension === "time" && dimensionMode !== "all" && selectedDimensionValues.includes("年代不明") && excludeUnknown ? "不能在时间分类中选中“年代不明”，同时又排除年代不明书信。" : "");
  const estimatedCategories = estimateVisibleCategories(effectiveDimension, sourceDimension, dimensionMode, selectedDimensionValues, effectiveEventScope, effectiveActionScope, minFrequency);
  const blockingReason = selections.length === 0 ? "请至少选择一个分析对象。" : subjectMode === "cooccur" && selections.length < 2 ? "共现分析至少需要选择两个实体对象。" : modeError || (estimatedSample < 2 ? "当前条件预计不足 2 封书信，请放宽限定条件。" : estimatedCategories < 2 ? "当前条件下不足两个有效分类，无法形成分布；请更换观察维度或放宽条件。" : "");
  const warnings = getWarnings({ isComparison, normalization, minFrequency, dimension: effectiveDimension, includesUnknownTime: effectiveDimension === "time" && !excludeUnknown && (sourceDimension !== "time" || selectedDimensionValues.includes("年代不明")), metric });
  if (estimatedSample < 6 && !blockingReason) warnings.push(`当前条件预计只剩 ${estimatedSample} 封书信，结论需要结合原文谨慎解释。`);
  const conditionLabels = buildConditionLabels({ layer, sourceDimension, dimensionMode, selectedDimensionValues, period: effectivePeriod, eventScope: effectiveEventScope, actionScope: effectiveActionScope, letterScope: effectiveLetterScope });
  const config: AnalysisConfig = {
    layer, entityType, entityTypes: selectedEntityTypes, granularity, selections, subjectMode, subjectLabel, sourceDimension, dimensionMode, dimensionValues: selectedDimensionValues, dimension: effectiveDimension, metric, normalization,
    isComparison, comparisonLabel, eventScope: effectiveEventScope, actionScope: effectiveActionScope,
    letterScope: effectiveLetterScope, period: effectivePeriod, minFrequency, topN, excludeUnknown, analysisType, estimatedSample, conditionLabels, blockingReason, warnings,
  };
  const recommendedCharts = recommendCharts({ layer, granularity, dimension: config.dimension, metric: config.metric, isComparison });
  const activeChart = selectedChart && recommendedCharts.includes(selectedChart) ? selectedChart : recommendedCharts[0];
  const availableMetrics = metricOptions.filter((item) => metricAllowed(item.id, config.dimension));
  const visibleEntities = useMemo(() => {
    const query = entityQuery.trim().toLocaleLowerCase("zh-CN");
    return getEntitiesForSelectedTypes(selectedEntityTypes, entitySubtypeFilter).filter((item) => !query || displayEntity(item).toLocaleLowerCase("zh-CN").includes(query) || decodeEntity(item).type.toLocaleLowerCase("zh-CN").includes(query));
  }, [selectedEntityTypes, entitySubtypeFilter, entityQuery]);
  const question = buildQuestion(config);
  const invalidate = () => { setRan(false); setSelectedChart(null); };

  const changeLayer = (next: SubjectLayer) => {
    setLayer(next);
    setGranularity("type");
    setMetricOverride(null);
    setNormalizeOverride(null);
    const nextDimension: DimensionId = next === "event" ? "entity" : next === "action" ? "event" : next === "letters" ? "entity" : "event";
    setDimension(nextDimension);
    setDimensionMode("all");
    setDimensionValues(getDimensionValues(nextDimension));
    setSecondaryDimension(nextDimension === "event" ? "action" : "event");
    setSubjectMode("compare");
    setOtherSubjects(next === "event" ? [events[0]] : next === "action" ? [actions[1]] : ["全部书信"]);
    setEntityQuery("");
    invalidate();
  };

  const toggleEntityType = (next: string) => {
    const nextTypes = selectedEntityTypes.includes(next)
      ? (selectedEntityTypes.length > 1 ? selectedEntityTypes.filter((type) => type !== next) : selectedEntityTypes)
      : [...selectedEntityTypes, next].slice(-4);
    setSelectedEntityTypes(nextTypes);
    const nextSubtypes = nextTypes.flatMap((type) => entitySubtypes[type]?.[0] ? [encodeSubtype(type, entitySubtypes[type][0])] : []);
    setSelectedSubtypes(nextSubtypes);
    if (granularity === "subtype" && nextSubtypes.length !== nextTypes.length) setGranularity("type");
    setSelectedEntities(nextTypes.flatMap((type) => entityOptions[type].slice(0, 1).map((name) => encodeEntity(type, name))));
    setEntitySubtypeFilter("全部小类");
    setEntityQuery("");
    if (nextTypes.includes("时间") && dimension === "time") setDimension("event");
    if (nextTypes.includes("时间") && dimension === "time") setDimensionValues(events);
    if (nextTypes.length === 1 && subjectMode === "cooccur") setSubjectMode("compare");
    setMetricOverride(null);
    setNormalizeOverride(null);
    invalidate();
  };

  const changeGranularity = (next: Granularity) => {
    if (next === "subtype" && !canUseSubtypes) return;
    setGranularity(next);
    if (next === "subtype" && !selectedSubtypes.length) setSelectedSubtypes(selectedEntityTypes.map((type) => encodeSubtype(type, entitySubtypes[type][0])));
    if (next === "entity" && !selectedEntities.length) setSelectedEntities(selectedEntityTypes.flatMap((type) => entityOptions[type].slice(0, 1).map((name) => encodeEntity(type, name))));
    setEntityQuery("");
    setMetricOverride(null);
    setNormalizeOverride(null);
    invalidate();
  };

  const toggleSelection = (item: string, current: string[], setter: (value: string[]) => void, max = 5) => {
    setter(current.includes(item) ? current.filter((value) => value !== item) : [...current, item].slice(-max));
    setMetricOverride(null);
    setNormalizeOverride(null);
    invalidate();
  };

  const toggleSubjectSelection = (item: string) => {
    if (layer !== "letters") return toggleSelection(item, otherSubjects, setOtherSubjects);
    if (item === "全部书信") setOtherSubjects(["全部书信"]);
    else {
      const withoutAll = otherSubjects.filter((value) => value !== "全部书信");
      setOtherSubjects(withoutAll.includes(item) ? withoutAll.filter((value) => value !== item) : [...withoutAll, item]);
    }
    setMetricOverride(null);
    setNormalizeOverride(null);
    invalidate();
  };

  const changeDimension = (next: DimensionId) => {
    setDimension(next);
    setDimensionMode("all");
    setDimensionValues(getDimensionValues(next));
    const nextSecondaries = getSecondaryDimensions(layer, selectedEntityTypes, next);
    setSecondaryDimension(nextSecondaries[0]?.id ?? "entity");
    setMetricOverride(null);
    setNormalizeOverride(null);
    invalidate();
  };

  const changeDimensionMode = (next: DimensionMode) => {
    setDimensionMode(next);
    const values = getDimensionValues(sourceDimension);
    setDimensionValues(next === "all" ? values : next === "filter" ? values.slice(0, 1) : values.slice(0, Math.min(2, values.length)));
    setMetricOverride(null);
    setNormalizeOverride(null);
    invalidate();
  };

  const toggleFilter = (item: string, current: string[], setter: (value: string[]) => void) => {
    if (current.includes(item)) {
      if (current.length > 1) setter(current.filter((value) => value !== item));
    } else setter([...current, item]);
    invalidate();
  };

  const runAnalysis = () => {
    if (config.blockingReason) return;
    setRan(true);
    setHasGenerated(true);
  };

  const openDrawerPanel = (panel: "subject" | "dimension" | "scope" | "metric") => {
    setDrawerCollapsed(false);
    setOpenPanel(panel);
  };

  return (
    <section className="free-analysis-workbench">
      <section className={`studio-grid ${drawerCollapsed ? "drawer-collapsed" : ""}`}>
        <aside className={`config-rail ${drawerCollapsed ? "collapsed" : ""}`}>
          {drawerCollapsed ? <nav className="collapsed-rail" aria-label="研究设置"><button className="drawer-expand" onClick={() => setDrawerCollapsed(false)} aria-label="展开研究设置">→</button>{(["subject", "dimension", "scope", "metric"] as const).map((panel, index) => <button key={panel} onClick={() => openDrawerPanel(panel)} aria-label={`打开${["分析对象", "观察方式", "材料范围", "统计口径"][index]}`}>{String(index + 1).padStart(2, "0")}</button>)}</nav> : <>
          <div className="rail-intro compact">
            <div><span className="eyebrow">RULE-GUIDED ANALYSIS</span><h1>自由分析</h1><p>设置研究对象、观察方式与统计口径</p></div>
            <button className="drawer-collapse" onClick={() => setDrawerCollapsed(true)} aria-label="收起研究设置">←<span>收起</span></button>
          </div>

          <ConfigSection number="01" title="分析对象" summary={config.subjectLabel} open={openPanel === "subject"} onToggle={() => setOpenPanel("subject")}>
          <OptionGrid options={layers} value={layer} onChange={changeLayer} hideNotes />

          {layer === "entity" ? (
            <>
              <SubPanel title={<span className="title-with-note">实体大类 <small>可多选 · 最多 4 类</small></span>}>
                <ChoiceRow items={entityTypes} selected={selectedEntityTypes} onClick={toggleEntityType} />
              </SubPanel>
              <SubPanel title="对象粒度">
                <ChoiceRow items={canUseSubtypes ? ["整类实体", "实体小类", "具体实体"] : ["整类实体", "具体实体"]} selected={[granularity === "type" ? "整类实体" : granularity === "subtype" ? "实体小类" : "具体实体"]} onClick={(item) => changeGranularity(item === "整类实体" ? "type" : item === "实体小类" ? "subtype" : "entity")} />
              </SubPanel>

              {granularity === "type" ? (
                <div className="selection-block whole-type-block">
                  <div className="selection-title"><div><strong>{selectedEntityTypes.join("、")}</strong><span>包含所选大类下全部小类和全部规范实体</span></div><em>整类对象</em></div>
                  <InlineNote>当前不再要求选择实体小类。系统会直接判断每封信是否包含所选实体大类。</InlineNote>
                </div>
              ) : granularity === "subtype" ? (
                <div className="selection-block">
                  <div className="selection-title"><div><strong>选择一个或多个小类</strong><span>多选后可决定合并观察或分别比较</span></div><em>{selectedSubtypes.length > 1 ? `已选 ${selectedSubtypes.length} 个小类` : "整体对象"}</em></div>
                  <div className="typed-choice-groups">{selectedEntityTypes.map((type) => <section key={type}><strong>{type}</strong><div>{entitySubtypes[type].map((subtype) => { const value = encodeSubtype(type, subtype); const active = selectedSubtypes.includes(value); return <button key={value} className={active ? "active" : ""} onClick={() => toggleSelection(value, selectedSubtypes, setSelectedSubtypes)}>{subtype}{active ? " ✓" : ""}</button>; })}</div></section>)}</div>
                  <InlineNote>当前是“以小类为分析对象”。系统会统计该小类包含的全部规范实体，而不是只用小类筛选名称。</InlineNote>
                </div>
              ) : (
                <div className="selection-block">
                  <div className="selection-title"><div><strong>选择具体实体</strong><span>可单选，也可选择 2—5 个同类实体合并或比较</span></div><em>{selectedEntities.length > 1 ? `已选 ${selectedEntities.length} 个实体` : "单个实体"}</em></div>
                  <label className="subtype-filter"><span>先按大类或小类缩小候选范围</span><select value={entitySubtypeFilter} onChange={(event) => { const next = event.target.value; const candidates = getEntitiesForSelectedTypes(selectedEntityTypes, next); setEntitySubtypeFilter(next); setEntityQuery(""); setSelectedEntities(candidates.slice(0, 1)); invalidate(); }}><option>全部小类</option>{selectedEntityTypes.flatMap((type) => [<option key={type} value={encodeSubtype(type, "全部")}>{type} · 全部</option>, ...entitySubtypes[type].map((item) => <option key={encodeSubtype(type, item)} value={encodeSubtype(type, item)}>{type} · {item}</option>)])}</select></label>
                  <div className="entity-search"><input type="search" value={entityQuery} onChange={(event) => { setEntityQuery(event.target.value); invalidate(); }} placeholder={`搜索${selectedEntityTypes.join("、")}规范名或别名……`} /><span>{entityQuery ? `找到 ${visibleEntities.length} 项` : "按频次列出高频对象"}</span></div>
                  {visibleEntities.length ? <div className="entity-candidates">{visibleEntities.map((item) => { const decoded = decodeEntity(item); const active = selectedEntities.includes(item); return <button key={item} className={active ? "selected" : ""} onClick={() => toggleSelection(item, selectedEntities, setSelectedEntities)}><span>{decoded.name}</span><small>{decoded.type}</small>{active && <b>✓</b>}</button>; })}</div> : <div className="empty-candidates">当前条件下没有可选的规范实体，请放宽大类、小类或关键词条件。</div>}
                  <InlineNote>这里的小类只用于缩小候选范围，真正的分析对象仍是你选中的具体实体。</InlineNote>
                </div>
              )}
            </>
          ) : (
            <div className="selection-block">
              <div className="selection-title"><div><strong>选择对象</strong><span>多选后可决定合并观察或分别比较</span></div><em>{otherSubjects.length > 1 ? `已选 ${otherSubjects.length} 项` : "单项观察"}</em></div>
              <ChoiceRow items={layer === "event" ? events : layer === "action" ? actions : ["全部书信", ...letterGroups]} selected={otherSubjects} onClick={toggleSubjectSelection} />
            </div>
          )}
          {entityHasMultipleObjects && <SubPanel title="这些实体对象如何参与分析"><ChoiceRow items={["分别进行比较", "合并为一个集合", "观察同封信共现"]} selected={[subjectMode === "compare" ? "分别进行比较" : subjectMode === "cooccur" ? "观察同封信共现" : "合并为一个集合"]} onClick={(item) => { setSubjectMode(item === "合并为一个集合" ? "merge" : item === "观察同封信共现" ? "cooccur" : "compare"); setMetricOverride(null); setNormalizeOverride(null); invalidate(); }} /><InlineNote>{subjectMode === "compare" ? "每个对象单独计算，并使用相对指标减少规模差异。" : subjectMode === "cooccur" ? "只纳入所选对象同时出现的书信；共现不等于真实关系。" : "只要出现任一所选对象就纳入，结果不再区分各对象。"}</InlineNote></SubPanel>}
          {layer !== "entity" && selections.length > 1 && <SubPanel title="多选对象如何处理"><ChoiceRow items={["合并为一个集合", "分别进行比较"]} selected={[subjectMode === "merge" ? "合并为一个集合" : "分别进行比较"]} onClick={(item) => { setSubjectMode(item === "合并为一个集合" ? "merge" : "compare"); setMetricOverride(null); setNormalizeOverride(null); invalidate(); }} /></SubPanel>}
          </ConfigSection>

          <ConfigSection number="02" title="观察方式" summary={`${dynamicDimensionLabel(config.dimension, layer, granularity)} · ${sourceDimension === "time" ? timeDimensionModeLabel(dimensionMode) : dimensionModeLabel(dimensionMode)}`} open={openPanel === "dimension"} onToggle={() => setOpenPanel("dimension")}>
          <OptionGrid options={availableDimensions.map((item) => getDynamicDimensionOption(item, layer, granularity))} value={config.sourceDimension} onChange={changeDimension} />

          {categoricalDimension && <div className="dimension-intent">
            <div className="dimension-intent-head"><div><strong>{dimensionLabel(config.sourceDimension)}</strong><span>单选＝限定条件；多选＝分类比较</span></div></div>
            <ChoiceRow
              items={sourceDimension === "time" ? ["逐年完整分布", "选择若干年份比较", "限定到某一年"] : ["完整分类分布", "选择几类比较", "限定到其中一类"]}
              selected={[sourceDimension === "time" ? timeDimensionModeLabel(dimensionMode) : dimensionModeLabel(dimensionMode)]}
              onClick={(item) => changeDimensionMode(sourceDimension === "time" ? timeDimensionModeFromLabel(item) : dimensionModeFromLabel(item))}
            />
            {dimensionMode !== "all" && <div className="dimension-values"><strong>{dimensionMode === "compare" ? (sourceDimension === "time" ? "选择至少两个年份" : "选择至少两项") : (sourceDimension === "time" ? "选择一个年份作为条件" : "选择一项作为条件")}</strong><ChoiceRow items={getDimensionValues(config.sourceDimension)} selected={dimensionValues} onClick={(item) => toggleDimensionValue(item, dimensionMode, dimensionValues, setDimensionValues, invalidate)} /></div>}
            {dimensionMode === "filter" && <div className="secondary-dimension"><strong>限定以后，继续观察什么？</strong><OptionGrid options={allowedSecondaryDimensions.map((item) => getDynamicDimensionOption(item, layer, granularity))} value={config.dimension} onChange={(next) => { setSecondaryDimension(next); setMetricOverride(null); setNormalizeOverride(null); invalidate(); }} /></div>}
          </div>}

          {!categoricalDimension && <InlineNote>{getEntityDimensionExplanation(layer, granularity)}</InlineNote>}
          </ConfigSection>

          <ConfigSection number="03" title="材料范围" summary={scopeSummary(config.eventScope, config.actionScope, config.period, config.letterScope)} open={openPanel === "scope"} onToggle={() => setOpenPanel("scope")}>
            <div className="scope-body compact-scope">
              {layer === "event" || sourceDimension === "event" || config.dimension === "event" ? <LockedScope title="事件范围" values={config.eventScope} reason={layer === "event" ? "由分析对象决定" : sourceDimension === "event" && dimensionMode === "filter" ? "由研究限定决定" : "由观察维度决定"} /> : <FilterGroup title="事件范围">{events.map((item) => <Toggle key={item} active={eventFilter.includes(item)} onClick={() => toggleFilter(item, eventFilter, setEventFilter)}>{item}</Toggle>)}</FilterGroup>}
              {layer === "action" || sourceDimension === "action" || config.dimension === "action" ? <LockedScope title="行动范围" values={config.actionScope} reason={layer === "action" ? "由分析对象决定" : sourceDimension === "action" && dimensionMode === "filter" ? "由研究限定决定" : "由观察维度决定"} /> : <FilterGroup title="行动范围">{actions.map((item) => <Toggle key={item} active={actionFilter.includes(item)} onClick={() => toggleFilter(item, actionFilter, setActionFilter)}>{item}</Toggle>)}</FilterGroup>}
              {layer === "letters" ? <LockedScope title="书信范围" values={config.letterScope} reason="由分析对象决定" /> : <FilterGroup title="书信范围">{letterGroups.map((item) => <Toggle key={item} active={letterFilter.includes(item)} onClick={() => toggleFilter(item, letterFilter, setLetterFilter)}>{item}</Toggle>)}</FilterGroup>}
              <div className="filter-fields">
                {sourceDimension === "time" || config.dimension === "time" ? <label className="locked-field"><span>时间范围 · 由{sourceDimension === "time" && dimensionMode === "filter" ? "研究限定" : "观察维度"}决定</span><strong>{sourceDimension === "time" && dimensionMode === "all" ? `${continuousYears[0]}—${continuousYears.at(-1)}（逐年）` : sourceDimension === "time" && dimensionMode === "compare" ? `比较 ${config.dimensionValues.length} 个年份` : config.period}</strong></label> : <label><span>时间范围</span><select value={period} onChange={(event) => { setPeriod(event.target.value); invalidate(); }}>{periods.map((item) => <option key={item}>{item}</option>)}</select></label>}
                <label className="check-label"><input type="checkbox" checked={excludeUnknown} onChange={(event) => { setExcludeUnknown(event.target.checked); invalidate(); }} /><span>排除年代不明书信</span></label>
              </div>
            </div>
          </ConfigSection>

          <ConfigSection number="04" title="统计口径" summary={`${metricLabel(config.metric)} · ${normalizeLabel(config.normalization)}`} open={openPanel === "metric"} onToggle={() => setOpenPanel("metric")}>
            <div className="metric-compact"><span>系统推荐</span><strong>{metricLabel(config.metric)}</strong><small>{metricNote(config.metric)}</small></div>
            <SubPanel title="统计指标"><ChoiceRow items={availableMetrics.map((item) => item.label)} selected={[metricLabel(config.metric)]} onClick={(label) => { setMetricOverride(metricOptions.find((item) => item.label === label)?.id ?? null); setNormalizeOverride(null); invalidate(); }} /></SubPanel>
            <SubPanel title="计算方式"><ChoiceRow items={["原始数量", "每百封书信", "组内百分比", "相对全体基线"]} selected={[normalizeLabel(config.normalization)]} onClick={(label) => { setNormalizeOverride(normalizeFromLabel(label)); invalidate(); }} /></SubPanel>
            <div className="filter-fields metric-fields">
              <label><span>最低出现次数</span><input type="number" min="1" max="20" value={minFrequency} onChange={(event) => { setMinFrequency(Number(event.target.value)); invalidate(); }} /></label>
              <label><span>显示前 N 项</span><input type="number" min="5" max="30" value={topN} onChange={(event) => { setTopN(Number(event.target.value)); invalidate(); }} /></label>
            </div>
          </ConfigSection>

          </>}
        </aside>

        <section className="research-workbench">
          <header className="workbench-heading">
            <div><span className="eyebrow">CURRENT QUESTION</span><h2>{question}</h2></div>
            <span className={`status-pill ${config.blockingReason ? "blocked" : ""}`}>{config.blockingReason ? "组合待调整" : ran ? "结果已生成" : "问题已成立"}</span>
          </header>

          <div className="workbench-controls">
            <div className="workbench-meta">
              <button onClick={() => openDrawerPanel("subject")}><span>分析对象</span><strong>{config.subjectLabel}</strong><i>修改</i></button>
              <button onClick={() => openDrawerPanel("dimension")}><span>观察维度</span><strong>{dynamicDimensionLabel(config.dimension, layer, granularity)}</strong><i>修改</i></button>
              <button onClick={() => openDrawerPanel("metric")}><span>统计口径</span><strong>{metricLabel(config.metric)}</strong><i>修改</i></button>
              <button onClick={() => openDrawerPanel("scope")}><span>材料范围</span><strong>{config.estimatedSample} 封 · {config.period}</strong><i>修改</i></button>
            </div>
            <div className="workbench-run"><button disabled={Boolean(config.blockingReason)} onClick={runAnalysis} title={config.blockingReason || undefined}>{ran ? "重新生成" : hasGenerated ? "更新分析" : "生成分析"}<b>→</b></button></div>
          </div>

          {config.blockingReason ? (
            <div className="workbench-empty blocked"><span>当前问题尚未成立</span><h3>{config.blockingReason}</h3><p>请回到左侧相应配置项调整，系统会实时重新判断。</p></div>
          ) : ran ? (
            <div className="workbench-result">
              <div className="chart-switch"><span>结果视图</span>{recommendedCharts.map((item, index) => <button key={item} className={activeChart === item ? "selected" : ""} onClick={() => setSelectedChart(item)}>{index === 0 ? "推荐 · " : ""}{chartCatalog[item].label}</button>)}</div>
              <section className="workbench-chart"><header><div><span>分析结果</span><h3>{chartCatalog[activeChart].label}</h3></div><small>{chartCatalog[activeChart].note}</small></header><ChartPreview chart={activeChart} data={getMockData(config)} seriesLabels={config.isComparison ? config.selections.map((item) => config.granularity === "subtype" ? displaySubtype(item) : config.granularity === "entity" ? displayEntity(item) : item) : []} /></section>
              <div className="workbench-insight"><span>初步发现</span><p>{findingText(config)}</p><button>查看对应书信 <b>→</b></button></div>
            </div>
          ) : (
            <div className="workbench-empty">
              {hasGenerated && <div className="changed-notice">配置已变更，右侧保留问题结构；重新生成后更新图表。</div>}
              <span>预计生成</span><h3>{chartCatalog[activeChart].label}</h3><p>{chartCatalog[activeChart].note}。系统已在后台识别为“{config.analysisType}”，并采用“{normalizeLabel(config.normalization)}”。</p>
              <div className="preview-structure"><i /><i /><i /><i /><i /></div>
            </div>
          )}

          <footer className="workbench-footer">
            <div><span>限定条件</span><strong>{config.conditionLabels.length ? config.conditionLabels.join(" ∩ ") : "无额外限定"}</strong></div>
            <div><span>比较方式</span><strong>{config.comparisonLabel}</strong></div>
            <div><span>数据依据</span><strong>{analysisData.sourceTotals.entityMentions.toLocaleString()} 实体标注 · {analysisData.sourceTotals.events.toLocaleString()} 事件</strong></div>
          </footer>
        </section>
      </section>
    </section>
  );
}

function ConfigSection({ number, title, summary, open, onToggle, children }: { number: string; title: string; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <section className={`config-section ${open ? "open" : ""}`}><button className="config-section-head" onClick={onToggle} aria-expanded={open}><b>{number}</b><div><strong>{title}</strong><span>{summary}</span></div><i>{open ? "−" : "+"}</i></button>{open && <div className="config-section-body">{children}</div>}</section>;
}

function OptionGrid<T extends string>({ options, value, onChange, hideNotes = false }: { options: Option<T>[]; value: T; onChange: (value: T) => void; hideNotes?: boolean }) {
  return <div className={`option-grid ${hideNotes ? "labels-only" : ""}`}>{options.map((option) => <button key={option.id} className={value === option.id ? "selected" : ""} onClick={() => onChange(option.id)}><strong>{option.label}</strong>{!hideNotes && <small>{option.note}</small>}{value === option.id && <i>当前选择</i>}</button>)}</div>;
}

function ChoiceRow({ items, selected, onClick }: { items: string[]; selected: string[]; onClick: (item: string) => void }) {
  return <div className="choice-row">{items.map((item) => <button key={item} className={selected.includes(item) ? "selected" : ""} onClick={() => onClick(item)}>{item}{selected.includes(item) ? " ✓" : ""}</button>)}</div>;
}

function SubPanel({ title, children }: { title: React.ReactNode; children: React.ReactNode }) { return <div className="sub-panel"><strong>{title}</strong><div>{children}</div></div>; }
function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) { return <div className="filter-group"><strong>{title}</strong><div>{children}</div></div>; }
function LockedScope({ title, values, reason }: { title: string; values: string[]; reason: string }) { return <div className="filter-group locked-scope"><strong>{title}</strong><div><span>{reason}</span><b>{values.join("、") || "尚未选择"}</b></div></div>; }
function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button className={active ? "active" : ""} onClick={onClick}>{children}{active ? " ✓" : ""}</button>; }
function InlineNote({ children }: { children: React.ReactNode }) { return <div className="inline-note">{children}</div>; }

function ChartPreview({ chart, data, seriesLabels = [] }: { chart: ChartId; data: { label: string; value: number; secondary: number; series?: number[] }[]; seriesLabels?: string[] }) {
  const max = Math.max(...data.flatMap((item) => [item.value, item.secondary, ...(item.series ?? [])]), 1);
  if (chart === "heatmap") return <div className="heat-chart">{data.slice(0, 5).map((row, rowIndex) => <div className="heat-row" key={row.label}><strong>{row.label}</strong>{[.34, .62, .88, .48].map((factor, index) => <i key={index} style={{ opacity: Math.max(.14, ((row.value / max) * factor + rowIndex * .05)) }} />)}</div>)}</div>;
  if (chart === "line") {
    const linePoints = data.map((item, index) => {
      const x = data.length <= 1 ? 500 : 18 + (index / (data.length - 1)) * 964;
      const y = 252 - (item.value / max) * 224;
      return { ...item, x, y };
    });
    return <div className="continuous-line-chart"><svg viewBox="0 0 1000 270" preserveAspectRatio="none" role="img" aria-label="逐年连续时间分布"><line className="time-baseline" x1="18" y1="252" x2="982" y2="252" /><polyline points={linePoints.map((point) => `${point.x},${point.y}`).join(" ")} />{linePoints.map((point) => <circle key={point.label} cx={point.x} cy={point.y} r="4"><title>{point.label}：{point.value}</title></circle>)}</svg><div className="continuous-time-axis">{data.map((item, index) => <small key={item.label}>{index % 4 === 0 || index === data.length - 1 ? item.label.replace("年", "") : ""}</small>)}</div></div>;
  }
  if (chart === "columns") return <div className="time-chart columns">{data.map((item, index) => <div key={item.label} title={`${item.label}：${item.value}`}><span><i style={{ height: `${item.value === 0 ? 0 : Math.max((item.value / max) * 100, 4)}%` }} /></span><small>{index % 4 === 0 || index === data.length - 1 ? item.label.replace("年", "") : ""}</small></div>)}</div>;
  if (chart === "smallMultiples") return <div className="small-multiples">{(seriesLabels.length ? seriesLabels : ["对象组一", "对象组二"]).map((subject, subjectIndex) => <article key={subject}><strong>{subject}</strong>{data.slice(0, 5).map((item) => <div key={item.label}><span>{item.label}</span><i style={{ width: `${Math.max((((item.series?.[subjectIndex] ?? (subjectIndex === 0 ? item.value : item.secondary)) / max) * 100), 2)}%` }} /></div>)}</article>)}</div>;
  if (chart === "network") return <div className="network-chart"><strong>核心对象</strong>{data.slice(0, 7).map((item, index) => <span key={item.label} className={`node node-${index}`}>{item.label}</span>)}</div>;
  if (chart === "stacked") return <div className="stacked-chart">{data.slice(0, 5).map((item) => { const sum = item.value + item.secondary; const left = Math.round((item.value / sum) * 100); return <div key={item.label}><strong>{item.label}</strong><span><i style={{ width: `${left}%` }}>{left}%</i><b style={{ width: `${100 - left}%` }}>{100 - left}%</b></span></div>; })}</div>;
  if (chart === "grouped") return <div className="grouped-chart">{data.slice(0, 6).map((item) => <div key={item.label}><strong>{item.label}</strong><span><i style={{ width: `${(item.value / max) * 100}%` }} /><b style={{ width: `${(item.secondary / max) * 100}%` }} /></span><em>{item.value} / {item.secondary}</em></div>)}</div>;
  if (chart === "dot" || chart === "lollipop") return <div className={`dot-chart ${chart}`}>{data.slice(0, 10).map((item) => <div key={item.label}><strong>{item.label}</strong><span><i style={{ width: `${(item.value / max) * 100}%` }} /><b style={{ left: `${(item.value / max) * 100}%` }} /></span><em>{item.value}</em></div>)}</div>;
  return <div className="bar-chart">{data.slice(0, 10).map((item) => <div key={item.label}><strong>{item.label}</strong><span><i style={{ width: `${(item.value / max) * 100}%` }} /></span><em>{item.value}</em></div>)}</div>;
}

function recommendMetric(dimension: DimensionId, comparison: boolean): MetricId {
  if (comparison) return "share";
  if (dimension === "time") return "coverage";
  if (dimension === "entity") return "letters";
  return "letters";
}

function recommendNormalization(metric: MetricId, comparison: boolean, dimension: DimensionId): NormalizeId {
  if (metric === "association") return "baseline";
  if (metric === "share" || comparison) return "withinGroup";
  if (dimension === "time" || metric === "coverage") return "per100";
  return "raw";
}

function metricAllowed(metric: MetricId, dimension: DimensionId) {
  const allowed: Record<DimensionId, MetricId[]> = {
    event: ["letters", "mentions", "events", "coverage", "share", "association"],
    action: ["letters", "mentions", "events", "coverage", "share", "association"],
    time: ["letters", "mentions", "events", "coverage"],
    entity: ["letters", "mentions", "events", "share", "association", "cooccurrence"],
    letter: ["mentions", "events", "coverage"],
  };
  return allowed[dimension].includes(metric);
}

function getAvailableDimensions(layer: SubjectLayer, selectedEntityTypes: string[]) {
  const allowed: Record<SubjectLayer, DimensionId[]> = {
    entity: ["event", "action", "time", "entity"],
    event: ["entity", "action", "time"],
    action: ["event", "entity", "time"],
    letters: ["entity", "event", "action", "time"],
  };
  return dimensionOptions.filter((item) => allowed[layer].includes(item.id) && !(layer === "entity" && selectedEntityTypes.includes("时间") && item.id === "time"));
}

function getSecondaryDimensions(layer: SubjectLayer, selectedEntityTypes: string[], source: DimensionId) {
  return getAvailableDimensions(layer, selectedEntityTypes).filter((item) => item.id !== source);
}

function getDimensionValues(dimension: DimensionId) {
  if (dimension === "event") return events;
  if (dimension === "action") return actions;
  if (dimension === "time") return continuousYears;
  if (dimension === "letter") return letterGroups;
  return [];
}

function getDynamicDimensionOption(option: Option<DimensionId>, layer: SubjectLayer, granularity: Granularity): Option<DimensionId> {
  if (option.id !== "entity") return option;
  if (layer === "entity" && granularity === "type") return { ...option, label: "大类内部构成", note: "查看所选大类中的高频规范实体" };
  if (layer === "entity" && granularity === "subtype") return { ...option, label: "小类内部实体", note: "查看集合中的具体对象排行" };
  if (layer === "entity") return { ...option, label: "相关实体", note: "查看与所选实体共同出现的对象" };
  return { ...option, label: "实体构成", note: "查看当前对象涉及的实体类型与对象" };
}

function dynamicDimensionLabel(dimension: DimensionId, layer: SubjectLayer, granularity: Granularity) {
  return getDynamicDimensionOption(dimensionOptions.find((item) => item.id === dimension)!, layer, granularity).label;
}

function getEntityDimensionExplanation(layer: SubjectLayer, granularity: Granularity) {
  if (layer === "entity" && granularity === "type") return "这里分析所选实体大类内部包含哪些高频规范实体；多类比较时按大类分区呈现。";
  if (layer === "entity" && granularity === "subtype") return "这里分析所选小类内部包含哪些规范实体，并形成排行。";
  if (layer === "entity") return "这里分析与所选实体共同出现的相关实体；共现不等于真实社会关系。";
  return "这里分析当前事件、行动或书信集合中包含的实体构成。";
}

function dimensionModeLabel(mode: DimensionMode) { return { all: "完整分类分布", compare: "选择几类比较", filter: "限定到其中一类" }[mode]; }
function dimensionModeFromLabel(label: string): DimensionMode { return label === "选择几类比较" ? "compare" : label === "限定到其中一类" ? "filter" : "all"; }
function timeDimensionModeLabel(mode: DimensionMode) { return { all: "逐年完整分布", compare: "选择若干年份比较", filter: "限定到某一年" }[mode]; }
function timeDimensionModeFromLabel(label: string): DimensionMode { return label === "选择若干年份比较" ? "compare" : label === "限定到某一年" ? "filter" : "all"; }

function toggleDimensionValue(item: string, mode: DimensionMode, current: string[], setter: (items: string[]) => void, invalidate: () => void) {
  if (mode === "filter") setter([item]);
  else if (current.includes(item)) setter(current.filter((value) => value !== item));
  else setter([...current, item]);
  invalidate();
}

function getDimensionModeError(categorical: boolean, mode: DimensionMode, values: string[], secondary: Option<DimensionId>[]) {
  if (!categorical || mode === "all") return "";
  if (mode === "compare" && values.length < 2) return "分类比较至少需要选择两项。";
  if (mode === "filter" && values.length !== 1) return "分类限定必须选择且只能选择一项。";
  if (mode === "filter" && secondary.length === 0) return "限定以后没有可用的观察维度，请更换分析对象。";
  return "";
}

function recommendCharts(config: { layer: SubjectLayer; granularity: Granularity; dimension: DimensionId; metric: MetricId; isComparison: boolean }): ChartId[] {
  if (config.dimension === "time") return config.isComparison ? ["smallMultiples", "line", "columns"] : ["line", "columns", "dot"];
  if (config.metric === "cooccurrence") return ["network", "lollipop", "heatmap"];
  if (config.dimension === "entity") return config.isComparison ? ["smallMultiples", "grouped", "heatmap"] : ["lollipop", "bar", "dot"];
  if (config.isComparison) return ["smallMultiples", "grouped", "heatmap"];
  if (config.metric === "share") return ["stacked", "grouped", "heatmap"];
  return ["bar", "dot", "lollipop"];
}

function deriveAnalysisType(layer: SubjectLayer, granularity: Granularity, dimension: DimensionId, comparison: boolean) {
  if (layer === "entity" && granularity === "type" && comparison) return `实体大类 × ${dimensionLabel(dimension)}比较`;
  if (layer === "entity" && granularity === "type" && dimension === "entity") return "实体大类内部构成分析";
  if (layer === "entity" && granularity === "subtype" && comparison) return `实体小类 × ${dimensionLabel(dimension)}比较`;
  if (layer === "entity" && granularity === "subtype" && dimension === "entity") return "小类内部实体分析";
  if (comparison) return `${dimensionLabel(dimension)}组间比较`;
  if (dimension === "time") return "时间变化分析";
  return `${layerLabel(layer)} × ${dimensionLabel(dimension)}分布分析`;
}

function buildSubjectLabel(config: { layer: SubjectLayer; entityTypes: string[]; granularity: Granularity; selectedSubtypes: string[]; selectedEntities: string[]; otherSubjects: string[]; subjectMode: SubjectMode }) {
  if (config.layer === "entity") {
    const selected = config.granularity === "type" ? config.entityTypes : config.granularity === "subtype" ? config.selectedSubtypes.map(displaySubtype) : config.selectedEntities.map(displayEntity);
    const suffix = selected.length > 1 ? config.subjectMode === "merge" ? "（合并集合）" : config.subjectMode === "cooccur" ? "（同封信共现）" : "" : "";
    return selected.length ? `${selected.join("、")}${suffix}` : "实体";
  }
  return config.otherSubjects.length ? `${config.otherSubjects.join("、")}${config.otherSubjects.length > 1 && config.subjectMode === "merge" ? "（合并集合）" : ""}` : layerLabel(config.layer);
}

function buildQuestion(config: AnalysisConfig) {
  if (config.dimensionMode === "compare" && config.dimensionValues.length < 2) return `请选择至少两类${dimensionLabel(config.sourceDimension)}进行比较。`;
  const prefix = config.conditionLabels.length ? `${config.conditionLabels.join(" ∩ ")}条件下，` : "";
  const dimensionText = dynamicDimensionLabel(config.dimension, config.layer, config.granularity);
  const compareDimension = config.dimensionMode === "compare" && config.sourceDimension === config.dimension ? `在${config.dimensionValues.join("、")}之间` : `按照${dimensionText}展开时`;
  return `${prefix}${config.subjectLabel}${config.isComparison ? "之间" : ""}${compareDimension}，${metricLabel(config.metric)}有何${config.isComparison || config.dimensionMode === "compare" ? "差异" : "分布"}？`;
}

function buildConditionLabels(config: { layer: SubjectLayer; sourceDimension: DimensionId; dimensionMode: DimensionMode; selectedDimensionValues: string[]; period: string; eventScope: string[]; actionScope: string[]; letterScope: string[] }) {
  const labels: string[] = [];
  if (config.dimensionMode === "filter") {
    const value = config.selectedDimensionValues[0];
    labels.push(config.sourceDimension === "event" ? `${value}事件` : config.sourceDimension === "action" ? `${value}行动` : config.sourceDimension === "letter" ? `${value}书信组` : value);
  }
  if (config.layer !== "event" && config.sourceDimension !== "event" && config.eventScope.length < events.length) labels.push(`${config.eventScope.join("、")}事件`);
  if (config.layer !== "action" && config.sourceDimension !== "action" && config.actionScope.length < actions.length) labels.push(`${config.actionScope.join("、")}行动`);
  if (config.sourceDimension !== "time" && config.period !== "全部年代") labels.push(config.period);
  if (config.layer !== "letters" && config.sourceDimension !== "letter" && config.letterScope.length < letterGroups.length) labels.push(`${config.letterScope.length} 组书信`);
  return [...new Set(labels.filter(Boolean))];
}

function letterGroupForNumber(number: string) {
  const value = Number(number);
  if (value <= 50) return letterGroups[0];
  if (value <= 100) return letterGroups[1];
  if (value <= 200) return letterGroups[2];
  return letterGroups[3];
}

function matchesPeriod(letter: CompactLetter, period: string) {
  if (period === "全部年代") return true;
  if (period === "年代不明") return !letter.year;
  if (!letter.year) return false;
  const year = Number(letter.year);
  const exactYear = period.match(/^(\d{4})年$/);
  if (exactYear) return year === Number(exactYear[1]);
  if (period === "1895 年以前") return year <= 1895;
  if (period === "1896—1900") return year >= 1896 && year <= 1900;
  if (period === "1901—1905") return year >= 1901 && year <= 1905;
  if (period === "1906—1910") return year >= 1906 && year <= 1910;
  if (period === "1911 年以后") return year >= 1911;
  return true;
}

function matchesEntitySubject(letter: CompactLetter, entityTypes: string[], granularity: Granularity, selections: string[], subjectMode: SubjectMode) {
  if (!selections.length) return false;
  const matchesSelection = (selection: string) => {
    if (granularity === "type") return Object.keys(letter.entities[selection] ?? {}).length > 0;
    if (granularity === "subtype") {
      const decoded = decodeSubtype(selection);
      const targetTypes = decoded.subtype ? [decoded.type] : entityTypes;
      const subtype = decoded.subtype || selection;
      return targetTypes.some((type) => Object.values(letter.entities[type] ?? {}).some((entry) => entry.subtype === subtype));
    }
    const decoded = decodeEntity(selection);
    return decoded.type && entityTypes.includes(decoded.type)
      ? Boolean(letter.entities[decoded.type]?.[decoded.name])
      : entityTypes.some((type) => Boolean(letter.entities[type]?.[selection]));
  };
  return subjectMode === "cooccur" ? selections.every(matchesSelection) : selections.some(matchesSelection);
}

function filterRealLetters(config: Pick<AnalysisConfig, "layer" | "entityType" | "entityTypes" | "granularity" | "selections" | "subjectMode" | "eventScope" | "actionScope" | "period" | "letterScope" | "excludeUnknown">, selectionOverride?: string[]) {
  const selected = selectionOverride ?? config.selections;
  return realLetters.filter((letter) => {
    if (!config.letterScope.includes(letterGroupForNumber(letter.number))) return false;
    if (config.excludeUnknown && !letter.year) return false;
    if (!matchesPeriod(letter, config.period)) return false;
    if (config.eventScope.length < events.length && !config.eventScope.some((event) => (letter.events[event] ?? 0) > 0)) return false;
    if (config.actionScope.length < actions.length && !config.actionScope.some((action) => (letter.actions[action] ?? 0) > 0)) return false;
    if (config.layer === "entity" && !matchesEntitySubject(letter, config.entityTypes, config.granularity, selected, selectionOverride ? "merge" : config.subjectMode)) return false;
    if (config.layer === "event" && !selected.some((event) => (letter.events[event] ?? 0) > 0)) return false;
    if (config.layer === "action" && !selected.some((action) => (letter.actions[action] ?? 0) > 0)) return false;
    return true;
  });
}

function estimateRealSample(config: { layer: SubjectLayer; entityType: string; entityTypes: string[]; granularity: Granularity; selections: string[]; subjectMode: SubjectMode; eventScope: string[]; actionScope: string[]; period: string; letterScope: string[]; excludeUnknown: boolean }) {
  return filterRealLetters(config).length;
}

function estimateVisibleCategories(dimension: DimensionId, sourceDimension: DimensionId, dimensionMode: DimensionMode, dimensionValues: string[], eventScope: string[], actionScope: string[], minFrequency: number) {
  const total = dimension === "event" ? eventScope.length : dimension === "action" ? actionScope.length : dimension === "time" ? (sourceDimension === "time" && dimensionMode !== "filter" ? dimensionValues.length : continuousYears.length) : dimension === "letter" ? (sourceDimension === "letter" && dimensionMode !== "filter" ? dimensionValues.length : 6) : 8;
  const frequencyPenalty = minFrequency >= 15 ? 1 : minFrequency >= 8 ? 0 : 0;
  return Math.max(0, total - frequencyPenalty);
}

function getWarnings(config: { isComparison: boolean; normalization: NormalizeId; minFrequency: number; dimension: DimensionId; includesUnknownTime: boolean; metric: MetricId }) {
  const warnings: string[] = [];
  if (config.isComparison && config.normalization === "raw") warnings.push("当前比较对象的材料规模可能不同，使用原始数量容易放大大样本；建议改回“组内百分比”。");
  if (config.minFrequency <= 1) warnings.push("最低出现次数为 1，结果可能包含偶然出现的低频噪声。");
  if (config.includesUnknownTime) warnings.push("时间分析仍包含年代不明书信；可在材料范围中排除，以避免趋势被未知年代稀释。");
  if (config.metric === "cooccurrence") warnings.push("共同出现只表示同封信或同一标注范围内共现，不等于人物之间存在真实社会关系。");
  return warnings;
}

function scopeSummary(eventFilter: string[], actionFilter: string[], period: string, letterScope: string[]) {
  const eventText = eventFilter.length === events.length ? "全部事件" : `${eventFilter.length} 类事件`;
  const actionText = actionFilter.length === actions.length ? "全部行动" : `${actionFilter.length} 类行动`;
  const letterText = letterScope.length === letterGroups.length ? "全部书信" : `${letterScope.length} 组书信`;
  return `${period} · ${eventText} · ${actionText} · ${letterText}`;
}

function getEntitiesForSubtype(entityType: string, subtype: string) {
  if (subtype === "全部小类") return entityOptions[entityType];
  const explicit = entitySubtypeAssignments[entityType];
  if (explicit) return entityOptions[entityType].filter((entity) => explicit[entity] === subtype);
  const subtypeIndex = entitySubtypes[entityType].indexOf(subtype);
  return entityOptions[entityType].filter((_, index) => index % entitySubtypes[entityType].length === subtypeIndex);
}

function encodeSubtype(type: string, subtype: string) { return `${type}::${subtype}`; }
function decodeSubtype(value: string) {
  const [type, ...parts] = value.split("::");
  return { type, subtype: parts.join("::") };
}
function displaySubtype(value: string) {
  const decoded = decodeSubtype(value);
  return decoded.subtype ? `${decoded.type}·${decoded.subtype}` : value;
}
function encodeEntity(type: string, name: string) { return `${type}::${name}`; }
function decodeEntity(value: string) {
  const [type, ...parts] = value.split("::");
  return { type, name: parts.length ? parts.join("::") : value };
}
function displayEntity(value: string) {
  const decoded = decodeEntity(value);
  return decoded.name;
}
function getEntitiesForSelectedTypes(types: string[], filter: string) {
  if (filter === "全部小类") return types.flatMap((type) => (entityOptions[type] ?? []).map((name) => encodeEntity(type, name)));
  const { type, subtype } = decodeSubtype(filter);
  if (!types.includes(type)) return [];
  if (subtype === "全部") return (entityOptions[type] ?? []).map((name) => encodeEntity(type, name));
  return getEntitiesForSubtype(type, subtype).map((name) => encodeEntity(type, name));
}

function getMockData(config: AnalysisConfig) {
  const comparisonLetters = config.isComparison ? config.selections.map((selection) => filterRealLetters(config, [selection])) : [];
  const primaryLetters = config.isComparison ? comparisonLetters[0] ?? [] : filterRealLetters(config);
  const secondaryLetters = config.isComparison ? comparisonLetters[1] ?? [] : [];
  const timeLabels = config.sourceDimension === "time" && config.dimensionMode !== "filter"
    ? config.dimensionValues
    : continuousYears;

  let labels = config.dimension === "event"
    ? config.eventScope
    : config.dimension === "action"
      ? config.actionScope
      : config.dimension === "time"
        ? timeLabels
        : config.dimension === "letter"
          ? config.letterScope
          : getRealEntityLabels([...primaryLetters, ...secondaryLetters], config);

  const rawPrimary = labels.map((label) => realMetricForLabel(primaryLetters, label, config));
  const rawSecondary = labels.map((label) => realMetricForLabel(secondaryLetters, label, config));
  const rawSeries = comparisonLetters.map((letters) => labels.map((label) => realMetricForLabel(letters, label, config)));
  const primaryTotal = rawPrimary.reduce((sum, value) => sum + value, 0) || 1;
  const secondaryTotal = rawSecondary.reduce((sum, value) => sum + value, 0) || 1;
  const corpusValues = config.normalization === "baseline" ? labels.map((label) => realMetricForLabel(realLetters, label, config)) : [];

  const normalizeValue = (raw: number, seriesTotal: number, letterCount: number, index: number) => {
    if (config.normalization === "withinGroup" || config.metric === "share") return Math.round((raw / seriesTotal) * 100);
    if (config.normalization === "per100" || config.metric === "coverage") return Math.round((raw / Math.max(letterCount, 1)) * 100);
    if (config.normalization === "baseline") {
      const localRate = raw / Math.max(letterCount, 1);
      const corpusRate = (corpusValues[index] ?? 0) / realLetters.length;
      return corpusRate ? Math.round((localRate / corpusRate) * 100) : 0;
    }
    return raw;
  };

  const rows = labels.map((label, index) => ({
    label,
    value: normalizeValue(rawPrimary[index], primaryTotal, primaryLetters.length, index),
    secondary: secondaryLetters.length ? normalizeValue(rawSecondary[index], secondaryTotal, secondaryLetters.length, index) : 0,
    series: rawSeries.map((values, seriesIndex) => normalizeValue(values[index], values.reduce((sum, value) => sum + value, 0) || 1, comparisonLetters[seriesIndex].length, index)),
    raw: rawSeries.length ? rawSeries.reduce((sum, values) => sum + values[index], 0) : rawPrimary[index],
  }));
  rows.sort((a, b) => config.dimension === "time" ? labels.indexOf(a.label) - labels.indexOf(b.label) : b.raw - a.raw || a.label.localeCompare(b.label, "zh-CN"));
  labels = rows.map((row) => row.label);
  const visibleRows = config.dimension === "time" ? rows : rows.filter((item) => item.raw >= config.minFrequency).slice(0, config.topN);
  return visibleRows.map(({ label, value, secondary, series }) => ({ label, value, secondary, series }));
}

function getRealEntityLabels(letters: CompactLetter[], config: AnalysisConfig) {
  if (config.layer !== "entity") {
    return entityTypes.filter((type) => letters.some((letter) => Object.keys(letter.entities[type] ?? {}).length > 0));
  }
  const counts = new Map<string, number>();
  for (const letter of letters) {
    const typeGroups = config.layer === "entity"
      ? config.entityTypes.map((type) => ({ type, group: letter.entities[type] ?? {} }))
      : Object.entries(letter.entities).map(([type, group]) => ({ type, group }));
    for (const { type, group } of typeGroups) {
      for (const [name, entry] of Object.entries(group)) {
        if (config.layer === "entity" && config.granularity === "subtype" && !config.selections.some((selection) => { const decoded = decodeSubtype(selection); return decoded.type === type && decoded.subtype === entry.subtype; })) continue;
        if (config.layer === "entity" && config.granularity === "entity" && config.selections.some((selection) => { const decoded = decodeEntity(selection); return decoded.type === type && decoded.name === name; })) continue;
        counts.set(name, (counts.get(name) ?? 0) + entry.count);
      }
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN")).slice(0, Math.max(config.topN * 2, 20)).map(([name]) => name);
}

function realMetricForLabel(letters: CompactLetter[], label: string, config: AnalysisConfig) {
  const entityTypeLabel = config.dimension === "entity" && entityTypes.includes(label);
  const matching = letters.filter((letter) => {
    if (config.dimension === "event") return (letter.events[label] ?? 0) > 0;
    if (config.dimension === "action") return (letter.actions[label] ?? 0) > 0;
    if (config.dimension === "time") return matchesPeriod(letter, label);
    if (config.dimension === "letter") return letterGroupForNumber(letter.number) === label;
    if (entityTypeLabel) return Object.keys(letter.entities[label] ?? {}).length > 0;
    return Object.values(letter.entities).some((group) => Boolean(group[label]));
  });
  if (config.metric === "letters" || config.metric === "coverage" || config.metric === "share" || config.metric === "association") return matching.length;
  if (config.metric === "events") return matching.reduce((sum, letter) => sum + Object.values(letter.events).reduce((total, count) => total + count, 0), 0);
  if (config.dimension === "event") return matching.reduce((sum, letter) => sum + (letter.events[label] ?? 0), 0);
  if (config.dimension === "action") return matching.reduce((sum, letter) => sum + (letter.actions[label] ?? 0), 0);
  if (config.dimension === "entity") return matching.reduce((sum, letter) => {
    if (entityTypeLabel) return sum + Object.values(letter.entities[label] ?? {}).reduce((total, entry) => total + entry.count, 0);
    return sum + Object.values(letter.entities).reduce((total, group) => total + (group[label]?.count ?? 0), 0);
  }, 0);
  return matching.reduce((sum, letter) => sum + Object.values(letter.entities).reduce((entityTotal, group) => entityTotal + Object.values(group).reduce((total, entry) => total + entry.count, 0), 0), 0);
}

function findingText(config: AnalysisConfig) {
  const top = [...getMockData(config)].sort((a, b) => b.value - a.value)[0];
  if (config.dimension === "time") return `${config.subjectLabel}的材料${top ? `在“${top.label}”中当前值最高` : "呈现阶段差异"}。当前按${normalizeLabel(config.normalization)}处理，以减少各时期存量差异。`;
  if (config.isComparison) return `${config.subjectLabel}的内部构成并不相同；系统已使用${normalizeLabel(config.normalization)}，避免对象组规模差异直接决定图形大小。`;
  if (config.dimension === "entity") return `${config.subjectLabel}内部由少数高频实体和一组低频实体构成。点击图形应能返回相应书信原文。`;
  return `${config.subjectLabel}${top ? `在“${top.label}”中的当前指标最高` : "在不同分类中的分布并不均衡"}。这是根据当前筛选后的真实标注计算，具体原因仍需结合原文判断。`;
}

function layerLabel(id: SubjectLayer) { return layers.find((item) => item.id === id)?.label ?? id; }
function dimensionLabel(id: DimensionId) { return dimensionOptions.find((item) => item.id === id)?.label ?? id; }
function metricLabel(id: MetricId) { return metricOptions.find((item) => item.id === id)?.label ?? id; }
function metricNote(id: MetricId) { return metricOptions.find((item) => item.id === id)?.note ?? ""; }
function normalizeLabel(id: NormalizeId) { return { raw: "原始数量", per100: "每百封书信", withinGroup: "组内百分比", baseline: "相对全体基线" }[id]; }
function normalizeFromLabel(label: string): NormalizeId { return ({ 原始数量: "raw", 每百封书信: "per100", 组内百分比: "withinGroup", 相对全体基线: "baseline" } as Record<string, NormalizeId>)[label] ?? "raw"; }
