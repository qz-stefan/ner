import type { Metadata } from "next";
import { RequestTypeDetailPage } from "@/components/analysis/RequestTypeDetailPage";
import { TYPE_SLUG_MAP } from "@/lib/request-types";
import type { PathCode } from "@/lib/request-types";

const TYPE_NAMES: Record<PathCode, string> = {
  A: "先叙后请型",
  B: "论议收束型",
  C: "先请后叙型",
  D: "连环请托型",
};

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type: slug } = await params;
  const typeCode = TYPE_SLUG_MAP[slug];
  const name = typeCode ? TYPE_NAMES[typeCode] : "请求类型";
  return {
    title: `${name}｜叶德辉书信数字人文`,
    description: `查看叶德辉书信中「${name}」的统计依据、典型书信与原文证据。`,
  };
}

export default async function RequestTypeRoute({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { type: slug } = await params;
  const sp = await searchParams;
  const typeCode = TYPE_SLUG_MAP[slug];

  if (!typeCode) {
    return (
      <main className="min-h-[calc(100vh-64px)] bg-[var(--paper)] pb-20 font-serif">
        <div className="site-container py-20 text-center">
          <h1 className="text-[24px] text-[var(--ink)]">未找到对应请求类型</h1>
          <p className="mt-4 text-[13px] text-[var(--muted)]">请从请求类型总览页面选择一种类型。</p>
          <a className="mt-6 inline-block text-[12px] text-[var(--purple)] hover:underline" href="/analysis/request">← 返回请求类型总览</a>
        </div>
      </main>
    );
  }

  const from = typeof sp.from === "string" ? sp.from : undefined;
  const question = typeof sp.question === "string" ? sp.question : undefined;

  return <RequestTypeDetailPage typeCode={typeCode} from={from} question={question} />;
}

export function generateStaticParams() {
  return [
    { type: "narrate-then-request" },
    { type: "discuss-then-request" },
    { type: "request-then-narrate" },
    { type: "chained-request" },
  ];
}
