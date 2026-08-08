import Link from "next/link";
import {
  actionStyleVariables,
  actTypeMeta,
  entityStyleVariables,
  entityTypeMeta,
  eventStyleVariables,
  eventTypeMeta,
} from "@/lib/config";
import { dataset } from "@/lib/data-adapter";
import type { ActType, EntityType, EventType } from "@/lib/types";

const entityOrder = Object.keys(dataset.entityStats) as EntityType[];
const eventOrder = Object.keys(dataset.eventStats) as EventType[];
const actOrder = Object.keys(dataset.actStats) as ActType[];

type AnnotationLayerSidebarProps = {
  activeLayer?: "entity" | "event" | "act";
  activeCode?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

function DirectoryContents({ activeLayer, activeCode }: AnnotationLayerSidebarProps) {
  return (
    <div className="directory-contents">
      <details className="layer-section layer-entity" open={!activeLayer || activeLayer === "entity"}>
        <summary>
          <span><b>01</b><strong>第一层标注 <em>NER</em></strong><small>实体层：信里提到了谁、哪里、什么书？</small></span>
          <i aria-hidden="true">＋</i>
        </summary>
        <div className="category-list">
          {entityOrder.map((code) => {
            const stats = dataset.entityStats[code];
            const meta = entityTypeMeta[code];
            return (
              <Link
                className={`category-row entity-row${activeLayer === "entity" && activeCode === code ? " category-current" : ""}`}
                href={`/category/entity/${code}`}
                aria-current={activeLayer === "entity" && activeCode === code ? "page" : undefined}
                key={code}
              >
                <span className="category-main entity-legend" style={entityStyleVariables(code)}><strong>{meta.label}</strong><small>{code}</small></span>
                <span className="category-count">
                  {stats.canonicalCount
                    ? <>{stats.canonicalCount} 个规范实体 · {stats.mentionCount} 次出现</>
                    : <>暂无标注数据</>}
                </span>
                <span className="category-arrow" aria-hidden="true">→</span>
              </Link>
            );
          })}
        </div>
      </details>

      <details className="layer-section layer-event" open={activeLayer === "event"}>
        <summary>
          <span><b>02</b><strong>第二层标注 <em>EVT</em></strong><small>事件层：信里发生了什么？</small></span>
          <i aria-hidden="true">＋</i>
        </summary>
        <div className="category-list">
          {eventOrder.map((code) => {
            const stats = dataset.eventStats[code];
            return (
              <Link
                className={`category-row event-row${activeLayer === "event" && activeCode === code ? " category-current" : ""}`}
                href={`/category/event/${code}`}
                aria-current={activeLayer === "event" && activeCode === code ? "page" : undefined}
                key={code}
              >
                <span className="category-main event-legend" style={eventStyleVariables(code)}><strong>{eventTypeMeta[code].label}</strong><small>{code}</small></span>
                <span className="category-count">{stats.eventCount} 个事件 · 涉及 {stats.letterCount} 封信</span>
                <span className="category-arrow" aria-hidden="true">→</span>
              </Link>
            );
          })}
        </div>
      </details>

      <details className="layer-section layer-act" open={activeLayer === "act"}>
        <summary>
          <span><b>03</b><strong>第三层标注 <em>ACT</em></strong><small>行动层：这一段为什么写？</small></span>
          <i aria-hidden="true">＋</i>
        </summary>
        <div className="category-list">
          {actOrder.map((code) => {
            const stats = dataset.actStats[code];
            return (
              <Link
                className={`category-row act-row${activeLayer === "act" && activeCode === code ? " category-current" : ""}`}
                href={`/category/act/${code}`}
                aria-current={activeLayer === "act" && activeCode === code ? "page" : undefined}
                key={code}
              >
                <span className="category-main act-legend" style={actionStyleVariables(code)}><strong>{actTypeMeta[code].label}</strong><small>{code}</small></span>
                <span className="category-count">
                  {stats.paragraphCount > 0
                    ? <>{stats.paragraphCount} 个段落 · {stats.letterCount} 封信</>
                    : <>暂无段落标注数据</>}
                </span>
                <span className="category-arrow" aria-hidden="true">→</span>
              </Link>
            );
          })}
        </div>
      </details>
      <p className="directory-note">目录项目均为专题入口，同时对应正文中的标注图例；不会筛选右侧书信。</p>
    </div>
  );
}

export function AnnotationLayerSidebar({ activeLayer, activeCode, collapsed = false, onToggleCollapse }: AnnotationLayerSidebarProps = {}) {
  return (
    <>
      <aside className={`annotation-sidebar${collapsed ? " is-collapsed" : ""}`} aria-label="三层标注体系目录">
        <div className="sidebar-intro">
          <div className="sidebar-intro-copy"><span>ANNOTATION DIRECTORY</span><h2>三层标注体系</h2></div>
          {onToggleCollapse && (
            <button
              type="button"
              className="annotation-sidebar-toggle"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "展开三层标注目录" : "收起三层标注目录"}
              title={collapsed ? "展开目录" : "收起目录"}
            >
              <i aria-hidden="true">←</i>
              <b className="when-expanded">收起</b>
              <b className="when-collapsed">展开目录</b>
            </button>
          )}
        </div>
        <DirectoryContents activeLayer={activeLayer} activeCode={activeCode} />
      </aside>
      <details className="mobile-directory">
        <summary><span>三层标注体系目录</span><small>展开浏览专题入口</small><b aria-hidden="true">＋</b></summary>
        <DirectoryContents activeLayer={activeLayer} activeCode={activeCode} />
      </details>
    </>
  );
}
