"use client";

import Link from "next/link";
import { useState } from "react";
import type { PathCode } from "@/lib/request-types";
import { TYPE_ACCENTS, TYPE_ORDER, TYPE_SLUG_REVERSE } from "@/lib/request-types";
import clusterSource from "@/analysis-output/preliminary-request-path-clusters.json";
import academicSource from "@/analysis-output/academic-figure-statistics.json";

const clustering = clusterSource as unknown as {
  corpus: { allLetters: number; requestBearingLetters: number; requestInstances: number };
  types: { code: PathCode; name: string; letterCount: number; requestCount: number }[];
};

const academic = academicSource as unknown as {
  featureStatistics: {
    types: {
      code: PathCode;
      name: string;
      letterCount: number;
      corpusShare: number;
      features: Record<string, { mean: number }>;
    }[];
  };
};

const PATH_META: Record<PathCode, {
  short: string; keyFinding: string; keyValue: string; motif: string[];
}> = {
  A: { short: "请求后置", keyFinding: "请求通常在铺陈之后出现", keyValue: "首次请求平均位于全信72.5%处", motif: ["告知", "说明", "请求"] },
  B: { short: "论议收束", keyFinding: "讨论和说服最为集中", keyValue: "说服行动平均占30.7%", motif: ["告知", "论议", "请求"] },
  C: { short: "请求前置", keyFinding: "提出请求以后仍继续展开", keyValue: "请求后仍保留62.6%的篇幅", motif: ["请求", "继续说明", "论议"] },
  D: { short: "请求成组", keyFinding: "多个请求经常连续成组", keyValue: "连续请求程度达到87.7%", motif: ["事情", "请求·请求", "回收"] },
};

function PathMotif({ typeCode, small = false }: { typeCode: PathCode; small?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2" aria-label={`${PATH_META[typeCode].short}结构`}>
      {PATH_META[typeCode].motif.map((item, i) => (
        <span className="contents" key={`${typeCode}-${item}`}>
          {i > 0 && <span className="text-[10px] text-[var(--line-dark)]">→</span>}
          <span className={`${item.includes("请求") ? "text-[var(--purple)]" : "text-[var(--muted)]"} whitespace-nowrap ${small ? "text-[10px]" : "text-[12px]"}`}>{item}</span>
        </span>
      ))}
    </div>
  );
}

function PetalButton({ code, position }: { code: PathCode; position: "tl" | "tr" | "bl" | "br" }) {
  const type = academic.featureStatistics.types.find((t) => t.code === code)!;
  const placement = {
    tl: "bottom-1/2 right-1/2 mb-2 mr-2 pr-20 text-right items-end",
    tr: "bottom-1/2 left-1/2 mb-2 ml-2 pl-20 text-left items-start",
    bl: "right-1/2 top-1/2 mr-2 mt-2 pr-20 text-right items-end",
    br: "left-1/2 top-1/2 ml-2 mt-2 pl-20 text-left items-start",
  }[position];
  const radius = {
    tl: "75% 18% 55% 18%", tr: "18% 75% 18% 55%",
    bl: "18% 55% 18% 75%", br: "55% 18% 75% 18%",
  }[position];

  return (
    <Link
      className={`group absolute flex h-[184px] w-[min(330px,42vw)] flex-col justify-center border-0 bg-[rgba(81,78,70,.035)] px-8 py-6 transition-all duration-200 hover:z-10 hover:scale-[1.025] hover:bg-[rgba(79,103,130,.1)] hover:shadow-[0_4px_20px_rgba(39,36,42,.08)] focus-visible:z-10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--blue)] cursor-pointer ${placement}`}
      style={{ borderRadius: radius }}
      href={`/analysis/request/${TYPE_SLUG_REVERSE[code]}`}
      aria-label={`查看${type.name}`}
    >
      <span className="text-[10px] tracking-[.14em]" style={{ color: TYPE_ACCENTS[code] }}>{code} · {type.letterCount}封</span>
      <b className="mt-2 block text-[20px] font-normal tracking-[.04em]">{type.name}</b>
      <span className="mt-2 font-sans text-[10px] leading-5 text-[var(--muted)]">{PATH_META[code].keyValue}</span>
      <span className="mt-3"><PathMotif typeCode={code} small /></span>
      <span className="mt-2 text-[10px] text-[var(--blue)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">查看结构与原信 →</span>
    </Link>
  );
}

export function RequestOverviewPage() {
  const [hovered, setHovered] = useState<PathCode | null>(null);
  const preview = hovered ? academic.featureStatistics.types.find((t) => t.code === hovered)! : null;

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[var(--paper)] pb-20 font-serif">
      <div className="site-container">
        <div className="mx-auto max-w-[900px] text-center pt-9">
          <h1 className="text-[30px] font-semibold tracking-[.06em] text-[var(--ink)] sm:text-[34px]">
            叶德辉怎样提出请求？
          </h1>
          <p className="mx-auto mt-3 max-w-[680px] font-sans text-[11px] leading-6 text-[var(--muted)]" style={{ textWrap: "balance" }}>
            在{clustering.corpus.requestBearingLetters}封含有请求的书信中，可以归纳出四种较稳定的请求表达路径。选择一种结构，继续查看它的统计依据、典型书信与原文证据。
          </p>
        </div>

        {/* 花瓣布局（桌面端） */}
        <div className="relative mx-auto mt-6 hidden h-[400px] max-w-[800px] md:block">
          <PetalButton code="A" position="tl" />
          <PetalButton code="B" position="tr" />
          <PetalButton code="C" position="bl" />
          <PetalButton code="D" position="br" />
          <div className="absolute left-1/2 top-1/2 z-20 grid size-[148px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[var(--line-dark)] bg-[var(--paper)] text-center shadow-[0_8px_28px_rgba(39,36,42,.06)]">
            {preview ? (
              <div className="px-4">
                <span className="text-[10px]" style={{ color: TYPE_ACCENTS[preview.code] }}>{preview.code}</span>
                <b className="mt-1 block text-[15px] font-normal">{PATH_META[preview.code].short}</b>
                <small className="mt-2 block font-sans text-[9px] leading-4 text-[var(--muted)]">{PATH_META[preview.code].keyFinding}</small>
              </div>
            ) : (
              <div>
                <span className="text-[23px] text-[var(--purple)]">请求</span>
                <small className="mt-2 block font-sans text-[9px] text-[var(--muted)]">悬停预览<br />点击进入</small>
              </div>
            )}
          </div>
        </div>

        {/* 移动端列表 */}
        <div className="mt-7 grid gap-3 md:hidden">
          {TYPE_ORDER.map((code) => {
            const type = academic.featureStatistics.types.find((t) => t.code === code)!;
            return (
              <Link className="grid grid-cols-[1fr_auto] items-center border-0 border-b border-[var(--line)] bg-transparent py-4 text-left cursor-pointer hover:bg-[rgba(255,254,249,.55)]" href={`/analysis/request/${TYPE_SLUG_REVERSE[code]}`} key={code}>
                <span><small className="text-[10px]" style={{ color: TYPE_ACCENTS[code] }}>{code}</small><b className="ml-3 text-[17px] font-normal">{type.name}</b><small className="mt-2 block font-sans text-[10px] text-[var(--muted)]">{PATH_META[code].keyValue}</small></span>
                <span className="text-[11px] text-[var(--muted)]">{type.letterCount}封 →</span>
              </Link>
            );
          })}
        </div>

        {/* 底部信息 */}
        <div className="mx-auto mt-5 flex max-w-[800px] items-center justify-between border-t border-[var(--line)] pt-4 font-sans text-[10px] text-[var(--muted)]">
          <span>四类合计 {clustering.corpus.requestBearingLetters} 封书信 · {clustering.corpus.requestInstances} 个请求实例</span>
          <details className="relative text-right">
            <summary className="cursor-pointer text-[var(--ink)] hover:text-[var(--purple)]">研究说明 ＋</summary>
            <div className="absolute bottom-full right-0 z-30 mb-2 w-[360px] bg-[var(--surface)] p-4 text-left leading-5 shadow-[0_12px_30px_rgba(39,36,42,.12)]">
              四类由整封书信的行动顺序、请求位置与行动占比共同归纳。例行结尾套语未参与分类；类型稳定性与完整计算口径可在进入类型后查看。
            </div>
          </details>
        </div>
      </div>
    </main>
  );
}
