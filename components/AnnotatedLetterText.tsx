"use client";

import Link from "next/link";
import { Fragment, MouseEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { getEntityHref, getEntityKey, normalizeEntityAnnotation, normalizeEventAnnotation } from "@/lib/data-adapter";
import { entityStyleVariables, entityTypeMeta, eventStyleVariables, eventTypeMeta } from "@/lib/config";
import type { EntityMention, Letter } from "@/lib/types";
import { EntityPreviewCard } from "./EntityPreviewCard";

interface Props {
  letter: Letter;
  showEntity: boolean;
  showEvent: boolean;
  showAct: boolean;
  rangeStart?: number;
  rangeEnd?: number;
}

export function AnnotatedLetterText({ letter, showEntity, showEvent, showAct, rangeStart = 0, rangeEnd = letter.text.length }: Props) {
  const [finePointer, setFinePointer] = useState(false);
  const [preview, setPreview] = useState<{ entity: EntityMention; anchor: HTMLElement; id: string } | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entities = showEntity ? normalizeEntityAnnotation(letter.id).filter((item) => item.start >= rangeStart && item.end <= rangeEnd) : [];
  const events = showEvent ? normalizeEventAnnotation(letter.id).filter((item) => item.start >= rangeStart && item.end <= rangeEnd) : [];

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  const closePreview = useCallback(() => {
    clearTimers();
    setPreview(null);
  }, [clearTimers]);

  const openPreview = useCallback((entity: EntityMention, anchor: HTMLElement, delay = 0) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
    const id = `entity-preview-${letter.id}-${entity.start}`.replace(/[^\w-]/g, "-");
    openTimer.current = setTimeout(() => setPreview({ entity, anchor, id }), delay);
  }, [letter.id]);

  const scheduleClose = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPreview(null), 160);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFinePointer(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("ye-entity-return-position");
      if (!stored) return;
      const position = JSON.parse(stored) as { letterId?: string; scrollY?: number };
      if (position.letterId !== letter.id) return;
      window.sessionStorage.removeItem("ye-entity-return-position");
      requestAnimationFrame(() => window.scrollTo({ top: position.scrollY ?? 0 }));
    } catch {
      // Browser history restoration remains available when storage is unavailable.
    }
  }, [letter.id]);

  function rememberReturnPosition() {
    try {
      window.sessionStorage.setItem("ye-entity-return-position", JSON.stringify({
        letterId: letter.id,
        scrollY: window.scrollY,
      }));
    } catch {
      // Entity navigation must never depend on storage availability.
    }
  }

  function handleEntityClick(event: MouseEvent<HTMLAnchorElement>, mention: EntityMention) {
    const anchor = event.currentTarget;
    const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const isKeyboardActivation = event.detail === 0;
    if (!supportsHover && !isKeyboardActivation && preview?.anchor !== anchor) {
      event.preventDefault();
      event.stopPropagation();
      openPreview(mention, anchor);
      return;
    }
    rememberReturnPosition();
  }

  function renderEntities(from: number, to: number): ReactNode[] {
    const nodes: ReactNode[] = [];
    let cursor = from;
    const mentions = entities
      .filter((mention) => mention.start >= from && mention.end <= to)
      .sort((a, b) => a.start - b.start || b.end - a.end);
    mentions.forEach((mention, index) => {
      if (mention.start < cursor) return;
      if (mention.start > cursor) nodes.push(letter.text.slice(cursor, mention.start));
      const anchorId = `entity-${letter.id}-${mention.start}`.replace(/[^\w-]/g, "-");
      nodes.push(
        <Link
          className={`entity-annotation entity-${mention.type.toLowerCase()}`}
          style={entityStyleVariables(mention.type)}
          key={`${mention.type}-${mention.start}-${index}`}
          id={anchorId}
          href={getEntityHref(mention)}
          data-entity-id={getEntityKey(mention)}
          aria-label={`查看${entityTypeMeta[mention.type].label}实体：${mention.canonical}`}
          aria-describedby={preview?.anchor.id === anchorId ? preview.id : undefined}
          onMouseEnter={(event) => finePointer && openPreview(mention, event.currentTarget, 125)}
          onMouseLeave={finePointer ? scheduleClose : undefined}
          onFocus={(event) => finePointer && openPreview(mention, event.currentTarget)}
          onBlur={finePointer ? scheduleClose : undefined}
          onClick={(event) => handleEntityClick(event, mention)}
        >
          {letter.text.slice(mention.start, mention.end)}
          <span className="sr-only">，规范实体{mention.canonical}</span>
        </Link>,
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
            style={eventStyleVariables(event.type)}
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
      {showAct && rangeStart === 0 ? (
        <span className="act-gutter-empty" title="现有数据中尚无行动层段落标注">
          <strong>行动层</strong><i>暂无标注</i>
        </span>
      ) : null}
      <p>{renderText().map((node, index) => <Fragment key={index}>{node}</Fragment>)}</p>
      {preview ? (
        <EntityPreviewCard
          anchor={preview.anchor}
          entity={preview.entity}
          isFinePointer={finePointer}
          previewId={preview.id}
          onClose={closePreview}
          onNavigate={rememberReturnPosition}
        />
      ) : null}
    </div>
  );
}
