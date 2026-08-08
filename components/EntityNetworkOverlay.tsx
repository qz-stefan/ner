"use client";

import { useEffect, useState } from "react";
import { getRelatedEntities } from "@/lib/data-adapter";
import type { EntityCatalogEntry } from "@/lib/types";
import { EntityCooccurrenceDemo } from "@/components/experiments/EntityCooccurrenceDemo";

export function EntityNetworkOverlay({ center }: { center: EntityCatalogEntry }) {
  const [open, setOpen] = useState(false);
  const relatedCount = getRelatedEntities(center, 20).length;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="entity-network-trigger"
        aria-expanded={open}
        aria-controls="entity-network-dialog"
        onClick={() => setOpen(true)}
      >
        <span>实体关系</span>
        <small>{relatedCount}</small>
        <i aria-hidden="true">→</i>
      </button>

      {open && (
        <div
          className="entity-network-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            id="entity-network-dialog"
            className="entity-network-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`${center.canonical}的实体共现网络`}
          >
            <button type="button" className="entity-network-close" aria-label="关闭实体共现网络" onClick={() => setOpen(false)}>×</button>
            <div className="entity-network-dialog-content">
              <EntityCooccurrenceDemo key={`${center.type}-${center.canonical}`} initialCenter={center} embedded />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
