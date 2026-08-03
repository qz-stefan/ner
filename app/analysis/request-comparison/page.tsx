import type { Metadata } from "next";
import { RequestComparisonPage } from "@/components/analysis/RequestComparisonPage";

export const metadata: Metadata = {
  title: "通信行动结构｜叶德辉书信数字人文",
  description: "观察叶德辉面对特定收信人时，请求前后的行动结构，并从统计结果回到原文细读。",
};

export default function RequestComparisonRoute() {
  return <RequestComparisonPage />;
}
