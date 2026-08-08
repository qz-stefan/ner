"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/site-path";

const navigation = [
  {
    href: "/annotation",
    label: "阅读标注书信",
    seal: "/home/seal-1.png",
    matches: (path: string) => path.startsWith("/annotation"),
  },
  {
    href: "/topics",
    label: "专项知识索引",
    seal: "/home/seal-4.png",
    matches: (path: string) => path.startsWith("/topics") || path.startsWith("/category/") || path.startsWith("/entity/"),
  },
  {
    href: "/analysis",
    label: "知识图谱分析",
    seal: "/home/seal-3.png",
    matches: (path: string) => path.startsWith("/analysis"),
  },
  {
    href: "/letters",
    label: "书信原文搜索",
    seal: "/home/seal-2.png",
    matches: (path: string) => path.startsWith("/letters") || path.startsWith("/letter/"),
  },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (pathname === "/") return null;

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="corner-brand" href="/" aria-label="返回纸上首页">
            <img src={withBasePath("/home/brand-lockup-zhi-shang-nav-v2.png")} alt="" aria-hidden="true" />
          </Link>
          <button
            className="directory-trigger"
            type="button"
            aria-label="打开网站目录"
            aria-expanded={open}
            aria-controls="site-directory"
            onClick={() => setOpen(true)}
          >
            <span>目录</span>
            <i aria-hidden="true" />
          </button>
        </div>
      </header>

      <button
        className={`directory-backdrop${open ? " is-open" : ""}`}
        type="button"
        aria-label="关闭网站目录"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <aside id="site-directory" className={`site-directory${open ? " is-open" : ""}`} aria-hidden={!open}>
        <div className="directory-topline">
          <span>目录</span>
          <button type="button" aria-label="关闭网站目录" onClick={() => setOpen(false)}>×</button>
        </div>

        <nav aria-label="网站目录">
          {navigation.map((item) => {
            const active = item.matches(pathname);
            return (
              <Link
                className={active ? "active" : undefined}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                key={item.href}
              >
                <img src={withBasePath(item.seal)} alt="" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link className="directory-about" href="/about" onClick={() => setOpen(false)}>
          <span aria-hidden="true">卷末</span>
          <strong>项目介绍</strong>
        </Link>
      </aside>
    </>
  );
}
