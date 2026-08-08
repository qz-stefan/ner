"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  actionStyleVariables,
  actTypeMeta,
  entityStyleVariables,
  entityTypeMeta,
  eventStyleVariables,
  eventTypeMeta,
} from "@/lib/config";
import { buildLetterAnnotationIndex, type LetterAnnotationIndexData } from "@/lib/letter-annotation-index";

const INITIAL_ENTITY_LIMIT = 5;

export interface LetterLayerVisibility {
  entity: boolean;
  event: boolean;
  act: boolean;
}

const LAYER_CONTROLS: { key: keyof LetterLayerVisibility; label: string }[] = [
  { key: "entity", label: "实体" },
  { key: "event", label: "事件" },
  { key: "act", label: "行动" },
];

function EmptyLayer({ children }: { children: string }) {
  return <p className="letter-index-empty">{children}</p>;
}

function EntityGroups({ data }: { data: LetterAnnotationIndexData["entities"] }) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  if (!data.groups.length) return <EmptyLayer>本信暂无实体标注</EmptyLayer>;

  return (
    <div className="letter-index-groups">
      {data.groups.map((group) => {
        const expanded = Boolean(expandedGroups[group.type]);
        const visibleEntities = expanded ? group.entities : group.entities.slice(0, INITIAL_ENTITY_LIMIT);
        return (
          <div className="letter-index-entity-group" key={group.type} style={entityStyleVariables(group.type)}>
            <div className="letter-index-category-row">
              <span className="letter-index-swatch entity-swatch" aria-hidden="true" />
              <strong>{entityTypeMeta[group.type].label}</strong>
              <span>{group.canonicalCount}个 · {group.mentionCount}处</span>
            </div>
            <ul className="letter-index-item-list">
              {visibleEntities.map((entity) => (
                <li key={entity.canonical}>
                  <span title={entity.canonical}>{entity.canonical}</span>
                  <small>{entity.mentionCount}处</small>
                </li>
              ))}
            </ul>
            {group.entities.length > INITIAL_ENTITY_LIMIT ? (
              <button
                className="letter-index-more"
                type="button"
                onClick={() => setExpandedGroups((current) => ({ ...current, [group.type]: !expanded }))}
                aria-expanded={expanded}
              >
                {expanded ? "收起" : `展开其余${group.entities.length - INITIAL_ENTITY_LIMIT}个`}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EventGroups({ data }: { data: LetterAnnotationIndexData["events"] }) {
  if (!data.groups.length) return <EmptyLayer>本信暂无事件标注</EmptyLayer>;
  return (
    <div className="letter-index-groups compact">
      {data.groups.map((group) => (
        <div className="letter-index-category-row" key={group.type} style={eventStyleVariables(group.type)}>
          <span className="letter-index-swatch event-swatch" aria-hidden="true" />
          <strong>{eventTypeMeta[group.type].label}</strong>
          <span>{group.count}个</span>
        </div>
      ))}
    </div>
  );
}

function ActGroups({ data }: { data: LetterAnnotationIndexData["acts"] }) {
  if (!data.groups.length) return <EmptyLayer>本信暂无行动标注</EmptyLayer>;
  return (
    <div className="letter-index-groups">
      {data.groups.map((group) => (
        <div className="letter-index-act-group" key={group.type} style={actionStyleVariables(group.type)}>
          <div className="letter-index-category-row">
            <span className="letter-index-swatch act-swatch" aria-hidden="true" />
            <strong>{actTypeMeta[group.type].label}</strong>
            <span>{group.count}段</span>
          </div>
          {group.subtypes.length ? (
            <ul className="letter-index-item-list letter-index-subtypes">
              {group.subtypes.map((subtype) => (
                <li key={subtype.label}>
                  <span>{subtype.label}</span>
                  <small>{subtype.count}段</small>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function LetterAnnotationIndex({
  letterId,
  layers,
  onLayersChange,
  children,
}: {
  letterId: string;
  layers: LetterLayerVisibility;
  onLayersChange: (layers: LetterLayerVisibility) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const data = useMemo(() => buildLetterAnnotationIndex(letterId), [letterId]);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const hasAnnotations = data.entities.mentionCount + data.events.count + data.acts.count > 0;
  const activeLayerCount = LAYER_CONTROLS.filter(({ key }) => layers[key]).length;
  const hasVisibleLayer = activeLayerCount > 0;

  function toggleLayer(key: keyof LetterLayerVisibility) {
    onLayersChange({ ...layers, [key]: !layers[key] });
  }

  function toggleAllLayers() {
    const visible = !hasVisibleLayer;
    onLayersChange({ entity: visible, event: visible, act: visible });
  }

  return (
    <div className={`letter-index-layout${open ? " is-open" : ""}`}>
      <aside className="letter-index-aside" aria-label="本信标注索引">
        {open ? (
          <section className="letter-index-panel" id={panelId} aria-labelledby={`${panelId}-title`}>
            <header className="letter-index-header">
              <div>
                <span>ANNOTATION INDEX</span>
                <h2 id={`${panelId}-title`}>本信标注</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="收起本信标注索引">收起&nbsp;←</button>
            </header>

            <div className="letter-index-summary">
              {hasAnnotations ? (
                <>
                  <p>{data.entities.canonicalCount}个规范实体 · {data.entities.mentionCount}处提及</p>
                  <p>{data.events.count}个事件 · {data.acts.count}个行动段落</p>
                </>
              ) : <p>本信暂无标注数据</p>}
            </div>

            <div className="letter-index-controls" aria-label="正文标注显示控制">
              <header>
                <span>标注显示</span>
                <button type="button" onClick={toggleAllLayers}>{hasVisibleLayer ? "隐藏全部" : "显示全部"}</button>
              </header>
              <div className="letter-index-control-buttons" role="group" aria-label="选择正文显示的标注层">
                {LAYER_CONTROLS.map(({ key, label }) => (
                  <button
                    type="button"
                    className={layers[key] ? "is-active" : ""}
                    aria-pressed={layers[key]}
                    onClick={() => toggleLayer(key)}
                    key={key}
                  >
                    {label}{layers[key] ? " ✓" : ""}
                  </button>
                ))}
              </div>
            </div>

            <div className="letter-index-sections">
              <details open>
                <summary><b>01</b><span>实体</span><small>{data.entities.canonicalCount}个</small><i aria-hidden="true">＋</i></summary>
                <EntityGroups data={data.entities} />
              </details>
              <details>
                <summary><b>02</b><span>事件</span><small>{data.events.count}个</small><i aria-hidden="true">＋</i></summary>
                <EventGroups data={data.events} />
              </details>
              <details>
                <summary><b>03</b><span>行动</span><small>{data.acts.count}段</small><i aria-hidden="true">＋</i></summary>
                <ActGroups data={data.acts} />
              </details>
            </div>

            <p className="letter-index-note">索引仅说明本信的标注构成，不改变正文的显示状态。</p>
          </section>
        ) : (
          <button
            type="button"
            className="letter-index-trigger"
            onClick={() => setOpen(true)}
            aria-expanded="false"
            aria-controls={panelId}
          >
            <span>本信标注</span>
            <small>{activeLayerCount}/3</small>
          </button>
        )}
      </aside>
      <div className="letter-index-reading-column">{children}</div>
    </div>
  );
}
