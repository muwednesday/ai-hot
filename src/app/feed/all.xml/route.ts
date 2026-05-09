import { prisma } from "@/lib/prisma";
import { Feed } from "feed";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const items = await prisma.item.findMany({
    where: { aiRelevance: { gte: 60 }, duplicateOfId: null },
    include: { source: { select: { name: true } } },
    orderBy: { publishedAt: "desc" },
    take: 100,
  });

  const feed = new Feed({
    title: "AI HOT — 全部动态",
    description: "AI HOT 全部 AI 行业动态（评分≥60）",
    id: `${siteUrl}/all`,
    link: `${siteUrl}/all`,
    language: "zh-CN",
    updated: items[0]?.publishedAt ?? new Date(),
    generator: "AI HOT",
    feedLinks: { rss: `${siteUrl}/feed/all.xml` },
  });

  for (const item of items) {
    feed.addItem({
      title: item.titleZh ?? item.title ?? "",
      id: item.id,
      link: item.url,
      description: item.summaryZh ?? item.content ?? "",
      date: item.publishedAt,
      author: [{ name: item.source.name }],
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
