import type { Metadata } from "next";
import { AnalysisPage } from "@/components/analysis/AnalysisPage";

export const metadata: Metadata = {
  title: "问题研究｜叶德辉书信数字人文",
  description: "从请求表达路径与书信收录构成两个核心问题进入叶德辉书信研究。",
  openGraph: {
    title: "问题研究｜叶德辉书信数字人文",
    description: "从请求表达路径与书信收录构成两个核心问题进入叶德辉书信研究。",
    images: [{ url: "/og-question-research.png", width: 1536, height: 1024, alt: "问题研究｜叶德辉书信数字人文" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "问题研究｜叶德辉书信数字人文",
    description: "从请求表达路径与书信收录构成两个核心问题进入叶德辉书信研究。",
    images: ["/og-question-research.png"],
  },
};

export default function AnalysisRoute() {
  return <AnalysisPage />;
}
