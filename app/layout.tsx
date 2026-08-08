import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ye-dehui-annotations.tempom.chatgpt.site";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const metadataBase = new URL(siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`);
  const title = "纸上｜叶德辉书信数字人文平台";
  const description = "从书信原文出发，连接人物、知识与行动，呈现别样的交往世界。";
  return {
    metadataBase,
    title,
    description,
    icons: { icon: `${basePath}/favicon.svg`, shortcut: `${basePath}/favicon.svg` },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `${basePath}/og.png`, width: 1536, height: 1024, alt: "纸上｜叶德辉书信数字人文平台" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${basePath}/og.png`] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body><SiteHeader />{children}</body>
    </html>
  );
}
