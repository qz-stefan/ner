import { TopicDetailPage } from "@/components/TopicDetailPage";
import { topicDefinitions } from "@/lib/config";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TopicDetailPage slug={slug} />;
}

export function generateStaticParams() {
  return topicDefinitions.map((topic) => ({ slug: topic.slug }));
}
