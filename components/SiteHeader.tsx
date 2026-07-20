"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "首页", matches: (path: string) => path === "/" },
  { href: "/letters", label: "书信", matches: (path: string) => path.startsWith("/letters") || path.startsWith("/letter/") },
  { href: "/annotation", label: "实体标注", matches: (path: string) => path.startsWith("/annotation") },
  { href: "/topics", label: "实体专题检索", matches: (path: string) => path.startsWith("/topics") || path.startsWith("/category/") || path.startsWith("/entity/") },
  { href: "/about", label: "关于项目", matches: (path: string) => path.startsWith("/about") },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/" aria-label="叶德辉书信数字人文首页">
          <span className="brand-seal" aria-hidden="true">叶</span>
          <span>
            <strong>叶德辉书信</strong>
            <small>DIGITAL CORRESPONDENCE</small>
          </span>
        </Link>
        <nav aria-label="主导航">
          {navigation.map((item) => {
            const active = item.matches(pathname);
            return <Link className={active ? "active" : undefined} href={item.href} aria-current={active ? "page" : undefined} key={item.href}>{item.label}</Link>;
          })}
        </nav>
        <span className="header-mark">书札中的<br />学术与交游</span>
      </div>
    </header>
  );
}
