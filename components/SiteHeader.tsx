import Link from "next/link";

export function SiteHeader() {
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
          <Link href="/">首页</Link>
          <Link href="/">书信</Link>
          <Link className="active" href="/" aria-current="page">实体标注</Link>
          <Link href="/category/entity/PER">专题索引</Link>
          <Link href="/#about">关于项目</Link>
        </nav>
        <span className="header-mark">书札中的<br />学术与交游</span>
      </div>
    </header>
  );
}
