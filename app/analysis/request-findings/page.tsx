import type { Metadata } from "next";
import { RequestFindingsPage } from "@/components/analysis/RequestFindingsPage";

export const metadata: Metadata = {
  title: "通信路径与人物差异｜叶德辉书信数字人文",
  description: "展示叶德辉请求书信的四种通信路径、人物组合差异与事务控制校验。",
};

export default function RequestFindingsRoute() {
  return <RequestFindingsPage />;
}
