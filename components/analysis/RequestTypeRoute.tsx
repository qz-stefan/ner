"use client";

import { useSearchParams } from "next/navigation";
import { RequestTypeDetailPage } from "@/components/analysis/RequestTypeDetailPage";
import type { PathCode } from "@/lib/request-types";

export function RequestTypeRoute({ typeCode }: { typeCode: PathCode }) {
  const search = useSearchParams();
  return (
    <RequestTypeDetailPage
      typeCode={typeCode}
      from={search.get("from") ?? undefined}
      question={search.get("question") ?? undefined}
    />
  );
}
