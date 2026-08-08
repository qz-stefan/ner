import Link from "next/link";
import type { CSSProperties } from "react";
import { TextCurtain } from "@/components/home/TextCurtain";
import styles from "@/components/home/home.module.css";
import { withBasePath } from "@/lib/site-path";

const entries = [
  {
    href: "/annotation",
    seal: "/home/seal-1.png",
    title: "阅读标注书信",
    description: "进入精选书信，查看人物、地点、典籍与行动标注。",
  },
  {
    href: "/topics",
    seal: "/home/seal-4.png",
    title: "专项知识索引",
    description: "按人物、地点、机构、典籍等专题查询相关知识。",
  },
  {
    href: "/analysis",
    seal: "/home/seal-3.png",
    title: "知识图谱分析",
    description: "探索书信中的实体关系、通信网络与关联路径。",
  },
  {
    href: "/letters",
    seal: "/home/seal-2.png",
    title: "书信原文搜索",
    description: "按通信人、年代或关键词查找并阅读原信。",
  },
] as const;

export function HomeLanding() {
  const pageStyle = {
    "--home-paper-background": `url("${withBasePath("/home/paper-background-v1.png")}")`,
    "--home-roof-mask": `url("${withBasePath("/home/yuelu-roof-3d-v1.png")}")`,
  } as CSSProperties;
  const roofImage = withBasePath("/home/yuelu-roof-3d-v1.png");

  return (
    <main className={styles.page} style={pageStyle} aria-label="纸上首页">
      <section className={styles.curtainPanel} aria-label="赫曦台书信文字珠帘">
        <div className={styles.curtainComposition}>
          <figure className={styles.curtainRoof} aria-label="岳麓书院赫曦台屋面">
            <img className={`${styles.curtainRoofShadow} ${styles.curtainRoofShadowCast}`} src={roofImage} alt="" aria-hidden="true" />
            <img className={`${styles.curtainRoofShadow} ${styles.curtainRoofShadowContact}`} src={roofImage} alt="" aria-hidden="true" />
            <img className={styles.curtainRoofSurface} src={roofImage} alt="岳麓书院赫曦台屋面、飞檐与斗拱" />
            <span className={styles.curtainRoofLight} aria-hidden="true" />
            <span className={styles.curtainRoofShade} aria-hidden="true" />
          </figure>

          <TextCurtain />
          <p className={styles.curtainNote}><strong>赫曦台</strong><span>书信文字垂落成帘。</span></p>
        </div>
      </section>

      <section className={styles.rightPanel} aria-label="纸上平台入口">
        <img className={styles.brandLockup} src={withBasePath("/home/brand-lockup-zhi-shang-v2.png")} alt="纸上｜叶德辉书信数字人文平台" />

        <nav className={styles.entryList} aria-label="进入纸上平台">
          {entries.map((entry) => (
            <Link className={styles.entry} href={entry.href} key={entry.href}>
              <img src={withBasePath(entry.seal)} alt="" aria-hidden="true" />
              <span className={styles.entryCopy}>
                <strong>{entry.title}</strong>
                <small>{entry.description}</small>
              </span>
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
