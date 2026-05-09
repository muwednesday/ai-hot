import { prisma } from "@/lib/prisma";
import { Feed } from "feed";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const items = await prisma.item.findMany({
    where: { aiSelected: true, duplicateOfId: null },
    include: { source: { select: { name: true } } },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const feed = new Feed({
    title: "AI HOT — 精选",
    description: "AI HOT 每日精选 AI 行业动态",
    id: `${siteUrl}/`,
    link: `${siteUrl}/`,
    language: "zh-CN",
    updated: items[0]?.publishedAt ?? new Date(),
    generator: "AI HOT",
    feedLinks: { rss: `${siteUrl}/feed.xml` },
  });

  for (const item of items) {
    feed.addItem({
      title: item.titleZh ?? item.title ?? "",
      id: item.id,
      link: item.url,
      description: item.summaryZh ?? item.content ?? "",
      date: item.publishedAt,
      author: [{ name: item.source.name }],
      category: item.aiTags.map((t) => ({ name: t })),
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
