import type { Metadata } from "next";
import { RequestOverviewPage } from "@/components/analysis/RequestOverviewPage";

export const metadata: Metadata = {
  title: "叶德辉怎样提出请求？｜叶德辉书信数字人文",
  description: "在178封含有请求的书信中，可以归纳出四种较稳定的请求表达路径。选择一种结构，继续查看它的统计依据、典型书信与原文证据。",
};

export default function RequestRoute() {
  return <RequestOverviewPage />;
}
