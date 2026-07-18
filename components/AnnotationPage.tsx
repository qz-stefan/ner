"use client";

import { useState } from "react";
import { AnnotationLayerSidebar } from "./AnnotationLayerSidebar";
import { FeaturedLetterViewer } from "./FeaturedLetterViewer";
import { LetterSearchBar } from "./LetterSearchBar";
import { LetterSearchResults } from "./LetterSearchResults";

export function AnnotationPage() {
  const [query, setQuery] = useState("");
  return (
    <main>
      <div className="search-band"><div className="site-container"><LetterSearchBar key={query} initialValue={query} onSearch={setQuery} /></div></div>
      <div className="site-container annotation-layout">
        <AnnotationLayerSidebar />
        <div className="annotation-main">
          {query ? <LetterSearchResults query={query} onClear={() => setQuery("")} /> : <FeaturedLetterViewer />}
        </div>
      </div>
    </main>
  );
}
