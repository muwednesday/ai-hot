import { prisma } from "@/lib/prisma";
import { Feed } from "feed";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const latestDaily = await prisma.daily.findFirst({
    orderBy: { date: "desc" },
  });

  const feed = new Feed({
    title: "AI HOT — 日报",
    description: "AI HOT 每日 AI 行业精选日报",
    id: `${siteUrl}/daily`,
    link: `${siteUrl}/daily`,
    language: "zh-CN",
    updated: latestDaily?.createdAt ?? new Date(),
    generator: "AI HOT",
    feedLinks: { rss: `${siteUrl}/feed/daily.xml` },
  });

  if (latestDaily) {
    const lead = latestDaily.lead as { title: string; summary: string };
    feed.addItem({
      title: lead.title,
      id: latestDaily.id,
      link: `${siteUrl}/daily/${latestDaily.date.toISOString().split("T")[0]}`,
      description: lead.summary,
      date: latestDaily.date,
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
