import type { Metadata } from "next";
import { HomeLanding } from "@/components/home/HomeLanding";

export const metadata: Metadata = {
  title: "纸上｜叶德辉书信数字人文平台",
  description: "从书信原文出发，连接人物、知识与行动，呈现别样的交往世界。",
};

export default function Home() {
  return <HomeLanding />;
}
