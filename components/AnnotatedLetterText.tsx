"use client";

import { Fragment, ReactNode, useCallback, useState } from "react";
import { normalizeEntityAnnotation, normalizeEventAnnotation } from "@/lib/data-adapter";
import { eventTypeMeta } from "@/lib/config";
import type { EntityMention, Letter } from "@/lib/types";
import { EntityInfoCard } from "./EntityInfoCard";

interface Props {
  letter: Letter;
  showEntity: boolean;
  showEvent: boolean;
  showAct: boolean;
  rangeStart?: number;
  rangeEnd?: number;
}

export function AnnotatedLetterText({ letter, showEntity, showEvent, showAct, rangeStart = 0, rangeEnd = letter.text.length }: Props) {
  const [selectedEntity, setSelectedEntity] = useState<EntityMention | null>(null);
  const closeCard = useCallback(() => setSelectedEntity(null), []);
  const entities = showEntity ? normalizeEntityAnnotation(letter.id).filter((item) => item.start >= rangeStart && item.end <= rangeEnd) : [];
  const events = showEvent ? normalizeEventAnnotation(letter.id).filter((item) => item.start >= rangeStart && item.end <= rangeEnd) : [];

  function renderEntities(from: number, to: number): ReactNode[] {
    const nodes: ReactNode[] = [];
    let cursor = from;
    const mentions = entities
      .filter((mention) => mention.start >= from && mention.end <= to)
      .sort((a, b) => a.start - b.start || b.end - a.end);
    mentions.forEach((mention, index) => {
      if (mention.start < cursor) return;
      if (mention.start > cursor) nodes.push(letter.text.slice(cursor, mention.start));
      nodes.push(
        <button
          className={`entity-annotation entity-${mention.type.toLowerCase()}`}
          type="button"
          key={`${mention.type}-${mention.start}-${index}`}
          onClick={(event) => {
            event.stopPropagation();
            setSelectedEntity(mention);
          }}
          aria-label={`${mention.surface}，${mention.type}实体，查看说明`}
        >
          {letter.text.slice(mention.start, mention.end)}
        </button>,
      );
      cursor = mention.end;
    });
    if (cursor < to) nodes.push(letter.text.slice(cursor, to));
    return nodes;
  }

  function renderText() {
    if (!events.length) return renderEntities(rangeStart, rangeEnd);
    const nodes: ReactNode[] = [];
    let cursor = rangeStart;
    events
      .sort((a, b) => a.start - b.start)
      .forEach((event) => {
        if (event.start < cursor) return;
        if (event.start > cursor) nodes.push(...renderEntities(cursor, event.start));
        nodes.push(
          <span
            className={`event-range event-${event.type.toLowerCase()}`}
            data-event={`${eventTypeMeta[event.type].label} · ${event.type}`}
            key={event.id}
            tabIndex={0}
            aria-label={`${eventTypeMeta[event.type].label}事件范围`}
          >
            {renderEntities(event.start, event.end)}
          </span>,
        );
        cursor = event.end;
      });
    if (cursor < rangeEnd) nodes.push(...renderEntities(cursor, rangeEnd));
    return nodes;
  }

  return (
    <div className={`annotated-text ${showAct ? "act-visible" : ""}`}>
      {showAct && rangeStart === 0 ? <span className="act-edge act-empty" title="现有数据中尚无行动层段落标注">ACT<br /><i>暂无数据</i></span> : null}
      <p>{renderText().map((node, index) => <Fragment key={index}>{node}</Fragment>)}</p>
      {selectedEntity ? <EntityInfoCard entity={selectedEntity} letterId={letter.id} onClose={closeCard} /> : null}
    </div>
  );
}
