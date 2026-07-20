import Link from "next/link";
import { getTopicSummaries } from "@/lib/data-adapter";

export function TopicsPage() {
  const topics = getTopicSummaries();
  return (
    <main className="topics-page site-container">
      <header className="topics-heading">
        <span>ENTITY TOPICS</span>
        <h1>实体专题检索</h1>
        <p>这里汇总展示叶德辉书信中的各类实体专题，按类型分类，可进入对应专题页面查看实体列表、出现情况与相关书信。</p>
      </header>
      <section className="topic-grid" aria-label="实体专题类别">
        {topics.map((topic, index) => (
          <Link className="topic-card" href={`/topics/${topic.slug}`} key={topic.id}>
            <span className="topic-order">{String(index + 1).padStart(2, "0")}</span>
            <span className="topic-code">{topic.englishLabel}</span>
            <h2>{topic.name}</h2>
            <p>{topic.description}</p>
            {topic.status === "available" ? (
              <dl><div><dt>{topic.entityCount}</dt><dd>{topic.kind === "event" ? "个事件类型" : "个规范实体"}</dd></div><div><dt>{topic.mentionCount}</dt><dd>次出现</dd></div></dl>
            ) : <p className="topic-pending">数据整理中</p>}
            <span className="topic-link">查看专题 <i aria-hidden="true">→</i></span>
          </Link>
        ))}
      </section>
    </main>
  );
}
