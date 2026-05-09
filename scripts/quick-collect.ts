import { config } from "dotenv";
config({ path: ".env.local", override: true });
config({ path: ".env", override: false });

import { ProxyAgent, Agent, request as undiciRequest } from "undici";
const PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "http://127.0.0.1:7899";
const directAgent = new Agent();
const proxyAgent = new ProxyAgent(PROXY);

import { PrismaClient } from "@prisma/client";
import Parser from "rss-parser";

const prisma = new PrismaClient();
const parser = new Parser({ timeout: 10000 });

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

// 国内的域名不走代理
const DOMESTIC_DOMAINS = ["qbitai.com", "36kr.com", "ithome.com", "jiqizhixin.com"];

function needsProxy(url: string): boolean {
  const host = new URL(url).hostname;
  return !DOMESTIC_DOMAINS.some(d => host.endsWith(d));
}

// Fetch via undici.request (more reliable proxy handling than global fetch)
async function fetchText(url: string): Promise<string> {
  const { body } = await undiciRequest(url, {
    dispatcher: needsProxy(url) ? proxyAgent : directAgent,
    headers: { "User-Agent": BROWSER_UA },
    headersTimeout: 10000,
    bodyTimeout: 10000,
  });
  return await body.text();
}

// Fetch RSS and parse
async function fetchAndParseRSS(url: string) {
  const text = await fetchText(url);
  return parser.parseString(text);
}

console.log(`🌐 代理: ${PROXY} (国内站点直连)\n`);

const HN_API = "https://hacker-news.firebaseio.com/v0";

const AI_KEYWORDS = [
  "ai", "ml", "llm", "gpt", "claude", "model", "neural", "deep learning",
  "machine learning", "transformer", "diffusion", "openai", "anthropic",
  "deepseek", "gemini", "copilot", "agent", "embedding", "rag", "rlhf",
];

interface SourceResult {
  name: string;
  slug: string;
  type: string;
  status: "ok" | "fail" | "skip";
  fetched: number;
  added: number;
  error?: string;
  duration: number;
}

async function main() {
  console.log("=== AI HOT 数据采集 ===\n");

  const allSources = await prisma.source.findMany({ where: { enabled: true } });
  const sources = allSources;
  console.log(`共 ${sources.length} 个数据源\n`);

  const results: SourceResult[] = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const progress = `[${i + 1}/${sources.length}]`;
    console.log(`${progress} 📡 ${source.name} (${source.type}) ...`);
    const start = Date.now();
    const result: SourceResult = {
      name: source.name,
      slug: source.slug,
      type: source.type,
      status: "skip",
      fetched: 0,
      added: 0,
      duration: 0,
    };

    try {
      let rawItems: { sourceId: string; title: string | null; url: string; content: string | null; publishedAt: Date; imageUrls: string[] }[] = [];
      const collectTimeout = (ms: number) => new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`超时(${ms / 1000}s)`)), ms)
      );

      switch (source.type) {
        case "rss":
          if (source.url) {
            rawItems = await Promise.race([collectRSS(source.id, source.url, source.name), collectTimeout(15000)]);
          } else {
            result.status = "skip";
            result.error = "无 URL";
          }
          break;
        case "x_user":
          if (source.xUsername) {
            rawItems = await Promise.race([collectX(source.id, source.xUsername, source.name), collectTimeout(15000)]);
          } else {
            result.status = "skip";
            result.error = "无 xUsername";
          }
          break;
        case "hn":
          rawItems = await Promise.race([collectHN(source.id), collectTimeout(30000)]);
          break;
        case "arxiv":
          rawItems = await Promise.race([collectArxiv(source.id), collectTimeout(15000)]);
          break;
        case "web":
          if (source.url) {
            rawItems = await Promise.race([collectWeb(source.id, source.url, source.name), collectTimeout(15000)]);
          } else {
            result.status = "skip";
            result.error = "无 URL";
          }
          break;
        default:
          result.status = "skip";
          result.error = `未知类型: ${source.type}`;
      }

      if (rawItems.length > 0 || result.status !== "skip") {
        const added = await insertNew(rawItems);
        result.fetched = rawItems.length;
        result.added = added;
        result.status = "ok";
        console.log(`       获取 ${rawItems.length} 条, 新增 ${added}条`);
      }
    } catch (e) {
      result.status = "fail";
      result.error = e instanceof Error ? e.message : String(e);
      console.log(`       ❌ 失败: ${result.error}`);
    }

    result.duration = Date.now() - start;
    results.push(result);
  }

  // 汇总报告
  console.log("\n========================================");
  console.log("          采集结果汇总");
  console.log("========================================");

  const okSources = results.filter(r => r.status === "ok");
  const failSources = results.filter(r => r.status === "fail");
  const skipSources = results.filter(r => r.status === "skip");

  console.log(`\n✅ 正常: ${okSources.length} 个`);
  for (const r of okSources) {
    const dup = r.fetched - r.added;
    console.log(`   ${r.name.padEnd(20)} 获取${r.fetched}条 新增${r.added}条 重复${dup}条 (${(r.duration / 1000).toFixed(1)}s)`);
  }

  if (failSources.length > 0) {
    console.log(`\n❌ 失败: ${failSources.length} 个`);
    for (const r of failSources) {
      console.log(`   ${r.name.padEnd(20)} ${r.error} (${(r.duration / 1000).toFixed(1)}s)`);
    }
  }

  if (skipSources.length > 0) {
    console.log(`\n⏭  跳过: ${skipSources.length} 个`);
    for (const r of skipSources) {
      console.log(`   ${r.name.padEnd(20)} ${r.error}`);
    }
  }

  const totalFetched = results.reduce((s, r) => s + r.fetched, 0);
  const totalAdded = results.reduce((s, r) => s + r.added, 0);
  const totalDupe = totalFetched - totalAdded;
  const dbTotal = await prisma.item.count();

  console.log("\n----------------------------------------");
  console.log(`  总获取: ${totalFetched} 条`);
  console.log(`  新增:   ${totalAdded} 条`);
  console.log(`  重复:   ${totalDupe} 条`);
  console.log(`  数据库总量: ${dbTotal} 条`);
  console.log("========================================\n");
}

async function collectRSS(sourceId: string, url: string, _name: string) {
  const feed = await fetchAndParseRSS(url);
  return feed.items
    .map(item => ({
      sourceId,
      title: item.title ?? null,
      url: item.link ?? "",
      content: (item.contentSnippet ?? item.content ?? "").slice(0, 2000),
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      imageUrls: [] as string[],
    }))
    .filter(i => i.url);
}

async function collectX(sourceId: string, username: string, _name: string) {
  const nitterUrl = `https://nitter.net/${username}/rss`;
  const feed = await fetchAndParseRSS(nitterUrl);
  return feed.items
    .slice(0, 20)
    .map(item => {
      // Convert nitter links back to x.com
      const link = (item.link ?? "").replace(/nitter\.net/g, "x.com");
      return {
        sourceId,
        title: item.title ?? null,
        url: link,
        content: (item.contentSnippet ?? item.content ?? "").slice(0, 2000),
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        imageUrls: [] as string[],
      };
    })
    .filter(i => i.url);
}

async function collectHN(sourceId: string) {
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

  return allItems
    .filter((item): item is NonNullable<typeof item> & { title: string } => {
      if (!item?.title) return false;
      const lower = (item.title as string).toLowerCase();
      return AI_KEYWORDS.some(kw => lower.includes(kw));
    })
    .slice(0, 30)
    .map(item => ({
      sourceId,
      title: item.title ?? null,
      url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
      content: item.text ?? null,
      publishedAt: new Date(((item.time as number) ?? 0) * 1000),
      imageUrls: [] as string[],
    }));
}

async function collectArxiv(sourceId: string) {
  const res = await fetch(
    "http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=20",
    { headers: { Accept: "application/xml" }, signal: AbortSignal.timeout(15000) },
  );
  const text = await res.text();
  const entries = text.split("<entry>").slice(1);

  return entries.map(entry => {
    const title = entry.match(/<title[^>]*>(.*?)<\/title>/s)?.[1]?.trim()?.replace(/\s+/g, " ");
    const id = entry.match(/<id[^>]*>(.*?)<\/id>/s)?.[1]?.trim();
    const summary = entry.match(/<summary[^>]*>(.*?)<\/summary>/s)?.[1]?.trim()?.replace(/\s+/g, " ");
    const published = entry.match(/<published[^>]*>(.*?)<\/published>/s)?.[1]?.trim();
    return {
      sourceId,
      title: title ?? null,
      url: id ?? "",
      content: summary ?? null,
      publishedAt: published ? new Date(published) : new Date(),
      imageUrls: [] as string[],
    };
  });
}

async function collectWeb(sourceId: string, url: string, _name: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-HOT/1.0)" },
  });
  const html = await res.text();

  // 尝试解析为 Atom/RSS (GitHub releases 等)
  if (url.endsWith(".atom") || url.endsWith(".xml") || url.includes("feed")) {
    try {
      const feed = await parser.parseString(text);
      return feed.items
        .map(item => ({
          sourceId,
          title: item.title ?? null,
          url: item.link ?? "",
          content: (item.contentSnippet ?? item.content ?? "").slice(0, 2000),
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          imageUrls: [] as string[],
        }))
        .filter(i => i.url);
    } catch {
      // fallback to HTML parsing
    }
  }

  // HTML 解析: 提取链接和标题
  const items: { sourceId: string; title: string | null; url: string; content: string | null; publishedAt: Date; imageUrls: string[] }[] = [];
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  let match;
  const seen = new Set<string>();
  while ((match = linkRegex.exec(html)) !== null && items.length < 20) {
    const href = match[1];
    const titleText = match[2].replace(/<[^>]*>/g, "").trim();
    if (href && titleText && href.startsWith("http") && !seen.has(href)) {
      seen.add(href);
      items.push({
        sourceId,
        title: titleText,
        url: href,
        content: null,
        publishedAt: new Date(),
        imageUrls: [],
      });
    }
  }
  return items;
}

async function insertNew(items: { sourceId: string; title: string | null; url: string; content: string | null; publishedAt: Date; imageUrls: string[] }[]): Promise<number> {
  if (items.length === 0) return 0;
  const urls = items.map(i => i.url).filter(Boolean);
  if (urls.length === 0) return 0;
  const existing = await prisma.item.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });
  const existingUrls = new Set(existing.map(i => i.url));
  const newItems = items.filter(i => !existingUrls.has(i.url));
  if (newItems.length > 0) {
    await prisma.item.createMany({ data: newItems, skipDuplicates: true });
  }
  return newItems.length;
}

main().catch(console.error).finally(() => prisma.$disconnect());
