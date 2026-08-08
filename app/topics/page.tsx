import type { Metadata } from "next";
import { TopicsPage } from "@/components/TopicsPage";

export const metadata: Metadata = {
  title: "专项知识索引｜纸上",
  description: "按人物、地点、机构、典籍、事件与行动专题浏览叶德辉书信知识。",
};

export default function TopicsRoute() {
  return <TopicsPage />;
}
