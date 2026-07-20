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

const entityOrder: EntityType[] = ["PER", "LOC", "BOK", "VER", "TIM", "OFF", "ORG", "KIN", "AST"];
const eventOrder: EventType[] = ["BIB", "ACA", "SOC", "POL", "FAM"];
const actOrder: ActType[] = ["REQ", "DSP", "INF", "PRS", "MNT", "INS", "NEG"];

function DirectoryContents() {
  return (
    <div className="directory-contents">
      <details className="layer-section layer-entity" open>
        <summary>
          <span><b>01</b><strong>实体层 <em>NER</em></strong><small>信里提到了谁、哪里、什么书？</small></span>
          <i aria-hidden="true">＋</i>
        </summary>
        <div className="category-list">
          {entityOrder.map((code) => {
            const stats = dataset.entityStats[code];
            const meta = entityTypeMeta[code];
            return (
              <Link className="category-row entity-row" href={`/category/entity/${code}`} key={code}>
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

      <details className="layer-section layer-event">
        <summary>
          <span><b>02</b><strong>事件层 <em>EVT</em></strong><small>信里发生了什么？</small></span>
          <i aria-hidden="true">＋</i>
        </summary>
        <div className="category-list">
          {eventOrder.map((code) => {
            const stats = dataset.eventStats[code];
            return (
              <Link className="category-row event-row" href={`/category/event/${code}`} key={code}>
                <span className="category-main event-legend" style={eventStyleVariables(code)}><strong>{eventTypeMeta[code].label}</strong><small>{code}</small></span>
                <span className="category-count">{stats.eventCount} 个事件 · 涉及 {stats.letterCount} 封信</span>
                <span className="category-arrow" aria-hidden="true">→</span>
              </Link>
            );
          })}
        </div>
      </details>

      <details className="layer-section layer-act">
        <summary>
          <span><b>03</b><strong>行动层 <em>ACT</em></strong><small>这一段为什么写？</small></span>
          <i aria-hidden="true">＋</i>
        </summary>
        <div className="category-list">
          {actOrder.map((code) => (
            <Link className="category-row act-row" href={`/category/act/${code}`} key={code}>
              <span className="category-main act-legend" style={actionStyleVariables(code)}><strong>{actTypeMeta[code].label}</strong><small>{code}</small></span>
              <span className="category-count">暂无段落标注数据</span>
              <span className="category-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </details>
      <p className="directory-note">目录项目均为专题入口，同时对应正文中的标注图例；不会筛选右侧书信。</p>
    </div>
  );
}

export function AnnotationLayerSidebar() {
  return (
    <>
      <aside className="annotation-sidebar" aria-label="三层标注体系目录">
        <div className="sidebar-intro"><span>ANNOTATION DIRECTORY</span><h2>三层标注体系</h2></div>
        <DirectoryContents />
      </aside>
      <details className="mobile-directory">
        <summary><span>三层标注体系目录</span><small>展开浏览专题入口</small><b aria-hidden="true">＋</b></summary>
        <DirectoryContents />
      </details>
    </>
  );
}
