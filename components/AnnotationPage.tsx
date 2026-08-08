import { FeaturedLetterViewer } from "./FeaturedLetterViewer";
export function AnnotationPage() {
  return (
    <main className="annotation-system-page">
      <div className="site-container annotation-system-shell">
        <header className="annotation-system-header">
          <div className="annotation-system-title">
            <span>ANNOTATION SYSTEM</span>
            <h1>三层标注体系</h1>
          </div>
        </header>

        <section
          className="annotation-primary-panel"
          aria-label="阅读标注书信"
        >
          <FeaturedLetterViewer />
        </section>
      </div>
    </main>
  );
}
