import projectContent from "@/data/project-content.json";

const sections = [
  { key: "introduction", title: "项目简介", english: "INTRODUCTION" },
  { key: "background", title: "研究背景", english: "BACKGROUND" },
  { key: "sources", title: "数据来源", english: "DATA SOURCES" },
  { key: "entityStandards", title: "实体分类标准", english: "ENTITY STANDARDS" },
  { key: "annotationLayers", title: "三层标注说明", english: "ANNOTATION LAYERS" },
  { key: "usage", title: "使用说明", english: "GUIDANCE" },
] as const;

export function AboutProjectPage() {
  return (
    <main className="about-page site-container">
      <header className="about-heading"><span>ABOUT THE PROJECT</span><h1>关于项目</h1><p>本页内容将由项目资料文件统一读取。</p></header>
      <div className="about-sections">
        {sections.map((section, index) => {
          const content = projectContent[section.key];
          return <section className="about-section" key={section.key}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{section.english}</small><h2>{section.title}</h2>{content ? <div className="about-content">{content}</div> : <p className="content-placeholder">内容待从项目资料文件读取</p>}</div></section>;
        })}
      </div>
    </main>
  );
}
