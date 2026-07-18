"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { entityTypeMeta } from "@/lib/config";
import type { EntityMention } from "@/lib/types";

interface Props {
  entity: EntityMention;
  letterId: string;
  onClose: () => void;
}

export function EntityInfoCard({ entity, letterId, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const onPointer = (event: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [onClose]);

  const meta = entityTypeMeta[entity.type];
  return (
    <div className="entity-card-shell" role="presentation">
      <div className="entity-info-card" ref={cardRef} role="dialog" aria-label={`${entity.canonical}标注信息`}>
        <Link className="entity-card-link" href={`/entity/${entity.type}/${encodeURIComponent(entity.canonical)}`}>
          <small>进入全库实体页</small><strong>← {entity.canonical}</strong>
        </Link>
        <div className="entity-card-description">
          <b>{meta.label} · {entity.type}</b>
          <span>
            本处标作“{entity.surface}”{entity.surface !== entity.canonical ? `，规范名为“${entity.canonical}”` : ""}
            {entity.subtype ? `，地点类别为 ${entity.subtype}` : ""}。
          </span>
        </div>
        <Link className="entity-card-detail" href={`/letter/${encodeURIComponent(letterId)}`}>本信详情 →</Link>
        <button className="entity-card-close" type="button" onClick={onClose} aria-label="关闭实体信息">×</button>
      </div>
    </div>
  );
}
