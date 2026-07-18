import { LetterDetailPage } from "@/components/LetterDetailPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LetterDetailPage id={decodeURIComponent(id)} />;
}
