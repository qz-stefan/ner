import { Suspense } from "react";
import { LetterDetailRoute } from "@/components/LetterDetailRoute";
import { dataset } from "@/lib/data-adapter";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={null}><LetterDetailRoute id={decodeURIComponent(id)} /></Suspense>;
}

export function generateStaticParams() {
  return dataset.letters.map((letter) => ({ id: letter.id }));
}
