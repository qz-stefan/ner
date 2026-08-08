import type { Metadata } from "next";
import { AnnotationPage } from "@/components/AnnotationPage";

export const metadata: Metadata = {
  title: "阅读标注书信｜纸上",
  description: "浏览叶德辉书信中的人物、地点、典籍与行动标注。",
};

export default function AnnotationRoute() {
  return <AnnotationPage />;
}
