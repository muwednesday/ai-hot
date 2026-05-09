import { config } from "dotenv";
config({ path: ".env.local", override: true });
config({ path: ".env", override: false });

import { PrismaClient } from "@prisma/client";
import Parser from "rss-parser";

const prisma = new PrismaClient();
const parser = new Parser();

const HN_API = "https://hacker-news.firebaseio.com/v0";

const AI_KEYWORDS = [
  "ai", "ml", "llm", "gpt", "claude", "model", "neural", "deep learning",
  "machine learning", "transformer", "diffusion", "openai", "anthropic",
  "deepseek", "gemini", "copilot", "agent", "embedding", "rag", "rlhf",
];

async function main() {
  console.log("=== 快速采集开始 ===\n");

  // 1. Hacker News
  console.log("📡 采集 Hacker News...");
  try {
    const hnSource = await prisma.source.findFirst({ where: { slug: "hn" } });
    if (hnSource) {
      const topRes = await fetch(`${HN_API}/topstories.json`);
      const ids: number[] = await topRes.json();
      const top50 = ids.slice(0, 50);
      const allItems = await Promise.all(
        top50.map(async (id) => {
          try {
            const res = await fetch(`${HN_API}/item/${id}.json`);
            return await res.json();
          } catch { return null; }
        }),
      );
      const aiItems = allItems
        .filter((item): item is NonNullable<typeof item> & { title: string } => {
          if (!item?.title) return false;
          const lower = (item.title as string).toLowerCase();
          return AI_KEYWORDS.some((kw) => lower.includes(kw));
        })
        .slice(0, 30);
      const rawItems = aiItems.map((item) => ({
        sourceId: hnSource.id,
        title: item.title ?? null,
        url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
        content: item.text ?? null,
        publishedAt: new Date(((item.time as number) ?? 0) * 1000),
        imageUrls: [] as string[],
      }));
      console.log(`  获取 ${rawItems.length} 条 AI 相关`);
      const inserted = await insertNew(rawItems);
      console.log(`  ✅ 新增 ${inserted} 条`);
    }
  } catch (e) {
    console.log(`  ❌ 失败: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // 2. arXiv
  console.log("\n📡 采集 arXiv...");
  try {
    const arxivSource = await prisma.source.findFirst({ where: { slug: "arxiv-ai" } });
    if (arxivSource) {
      const res = await fetch(
        "http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=20",
        { headers: { Accept: "application/xml" }, signal: AbortSignal.timeout(15000) },
      );
      const text = await res.text();
      const entries = text.split("<entry>").slice(1);
      const rawItems = entries.map((entry) => {
        const title = entry.match(/<title[^>]*>(.*?)<\/title>/s)?.[1]?.trim()?.replace(/\s+/g, " ");
        const id = entry.match(/<id[^>]*>(.*?)<\/id>/s)?.[1]?.trim();
        const summary = entry.match(/<summary[^>]*>(.*?)<\/summary>/s)?.[1]?.trim()?.replace(/\s+/g, " ");
        const published = entry.match(/<published[^>]*>(.*?)<\/published>/s)?.[1]?.trim();
        return {
          sourceId: arxivSource.id,
          title: title ?? null,
          url: id ?? "",
          content: summary ?? null,
          publishedAt: published ? new Date(published) : new Date(),
          imageUrls: [] as string[],
        };
      });
      console.log(`  获取 ${rawItems.length} 条`);
      const inserted = await insertNew(rawItems);
      console.log(`  ✅ 新增 ${inserted} 条`);
    }
  } catch (e) {
    console.log(`  ❌ 失败: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // 3. RSS feeds
  const rssSources = [
    { slug: "buzzing-hn", name: "Buzzing.cc" },
    { slug: "ithome", name: "IT之家" },
    { slug: "github-blog", name: "GitHub Blog" },
    { slug: "huggingface-blog", name: "Hugging Face Blog" },
  ];

  for (const { slug, name } of rssSources) {
    console.log(`\n📡 采集 ${name}...`);
    try {
      const source = await prisma.source.findFirst({ where: { slug } });
      if (source?.url) {
        const feed = await parser.parseURL(source.url);
        console.log(`  获取 ${feed.items.length} 条`);
        const rawItems = feed.items
          .map((item) => ({
            sourceId: source.id,
            title: item.title ?? null,
            url: item.link ?? "",
            content: (item.contentSnippet ?? item.content ?? "").slice(0, 2000),
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            imageUrls: [] as string[],
          }))
          .filter((i) => i.url);
        const inserted = await insertNew(rawItems);
        console.log(`  ✅ 新增 ${inserted} 条`);
      }
    } catch (e) {
      console.log(`  ❌ 失败: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  const total = await prisma.item.count();
  console.log(`\n=== 采集完成，数据库共 ${total} 条 ===`);
}

async function insertNew(items: { sourceId: string; title: string | null; url: string; content: string | null; publishedAt: Date; imageUrls: string[] }[]): Promise<number> {
  if (items.length === 0) return 0;
  const urls = items.map((i) => i.url).filter(Boolean);
  if (urls.length === 0) return 0;
  const existing = await prisma.item.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });
  const existingUrls = new Set(existing.map((i) => i.url));
  const newItems = items.filter((i) => !existingUrls.has(i.url));
  if (newItems.length > 0) {
    await prisma.item.createMany({ data: newItems, skipDuplicates: true });
  }
  return newItems.length;
}

main().catch(console.error).finally(() => prisma.$disconnect());
