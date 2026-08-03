import type { Metadata } from "next";
import { CorpusOverviewPage } from "@/components/analysis/CorpusOverviewPage";

export const metadata: Metadata = {
  title: "基础数据与视图导览｜叶德辉书信数字人文",
  description: "从年代、通信对象与三层标注出发，导览叶德辉书信数据并查看固定交叉分析。",
};

export default function CorpusOverviewRoute() {
  return <CorpusOverviewPage />;
}
