"use client";

import { useSearchParams } from "next/navigation";
import type { SearchScope } from "@/lib/types";
import { LetterDetailPage } from "@/components/LetterDetailPage";

export function LetterDetailRoute({ id }: { id: string }) {
  const search = useSearchParams();
  const rawScope = search.get("scope");
  const scope: SearchScope = rawScope === "recipient" || rawScope === "source" ? rawScope : "fulltext";
  const rawStart = search.get("at");
  const parsedStart = rawStart === null ? undefined : Number.parseInt(rawStart, 10);
  return (
    <LetterDetailPage
      id={id}
      query={search.get("q") ?? ""}
      scope={scope}
      matchStart={Number.isFinite(parsedStart) ? parsedStart : undefined}
    />
  );
}
