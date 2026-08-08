import { CategoryIndexPage } from "@/components/CategoryIndexPage";
import { actTypeMeta, entityTypeMeta, eventTypeMeta } from "@/lib/config";

export default async function Page({ params }: { params: Promise<{ layer: string; code: string }> }) {
  const { layer, code } = await params;
  return <CategoryIndexPage layer={layer} code={code} />;
}

export function generateStaticParams() {
  return [
    ...Object.keys(entityTypeMeta).map((code) => ({ layer: "entity", code })),
    ...Object.keys(eventTypeMeta).map((code) => ({ layer: "event", code })),
    ...Object.keys(actTypeMeta).map((code) => ({ layer: "act", code })),
  ];
}
