import { EntityDetailPage } from "@/components/EntityDetailPage";
import { dataset } from "@/lib/data-adapter";
import type { EntityType } from "@/lib/types";

export default async function Page({ params }: { params: Promise<{ type: string; name: string }> }) {
  const { type, name } = await params;
  return <EntityDetailPage type={type as EntityType} name={decodeURIComponent(name)} />;
}

export function generateStaticParams() {
  return dataset.entityCatalog.map((entry) => ({ type: entry.type, name: entry.canonical }));
}
