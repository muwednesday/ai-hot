import { prisma } from "@/lib/prisma";
import { fetchRssSource } from "./rss";
import { fetchXUser } from "./x";
import { fetchHackerNews } from "./hn";
import { fetchArxiv } from "./arxiv";
import type { RawItem } from "./types";

export async function runAllCollectors(): Promise<{
  total: number;
  newItems: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let total = 0;
  let newItems = 0;

  const sources = await prisma.source.findMany({
    where: { enabled: true },
  });

  for (const source of sources) {
    try {
      let rawItems: RawItem[] = [];

      switch (source.type) {
        case "rss":
          if (source.url) {
            rawItems = await withRetry(() =>
              fetchRssSource({
                id: source.id,
                url: source.url!,
                name: source.name,
              }),
            );
          }
          break;
        case "x_user":
          if (source.xUsername) {
            rawItems = await withRetry(() =>
              fetchXUser({
                id: source.id,
                username: source.xUsername!,
                name: source.name,
              }),
            );
          }
          break;
        case "hn":
          rawItems = await withRetry(() => fetchHackerNews(source.id));
          break;
        case "arxiv":
          rawItems = await withRetry(() => fetchArxiv(source.id));
          break;
      }

      total += rawItems.length;

      // Deduplicate by URL
      const urls = rawItems.map((i) => i.url).filter(Boolean);
      if (urls.length === 0) continue;

      const existing = await prisma.item.findMany({
        where: { url: { in: urls } },
        select: { url: true },
      });
      const existingUrls = new Set(existing.map((i) => i.url));

      const newRawItems = rawItems.filter((i) => !existingUrls.has(i.url));

      if (newRawItems.length > 0) {
        await prisma.item.createMany({
          data: newRawItems.map((i) => ({
            sourceId: i.sourceId,
            title: i.title,
            url: i.url,
            content: i.content,
            publishedAt: i.publishedAt,
            imageUrls: i.imageUrls,
          })),
          skipDuplicates: true,
        });
        newItems += newRawItems.length;
      }
    } catch (e) {
      errors.push(
        `${source.name}: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }

  return { total, newItems, errors };
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("unreachable");
}

export async function runAllCollectorsStreaming(
  onProgress: (info: {
    source: string;
    fetched: number;
    added: number;
    error?: string;
    done: number;
    total: number;
  }) => void,
): Promise<{ total: number; newItems: number; errors: string[] }> {
  const errors: string[] = [];
  let total = 0;
  let newItems = 0;

  const sources = await prisma.source.findMany({
    where: { enabled: true },
  });

  const totalSources = sources.length;

  // Process in parallel batches of 3
  const BATCH_SIZE = 3;
  for (let i = 0; i < sources.length; i += BATCH_SIZE) {
    const batch = sources.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (source) => {
        let rawItems: RawItem[] = [];
        try {
          switch (source.type) {
            case "rss":
              if (source.url) {
                rawItems = await withRetry(() =>
                  fetchRssSource({ id: source.id, url: source.url!, name: source.name }),
                );
              }
              break;
            case "x_user":
              if (source.xUsername) {
                rawItems = await withRetry(() =>
                  fetchXUser({ id: source.id, username: source.xUsername!, name: source.name }),
                );
              }
              break;
            case "hn":
              rawItems = await withRetry(() => fetchHackerNews(source.id));
              break;
            case "arxiv":
              rawItems = await withRetry(() => fetchArxiv(source.id));
              break;
          }

          const urls = rawItems.map((item) => item.url).filter(Boolean);
          let added = 0;
          if (urls.length > 0) {
            const existing = await prisma.item.findMany({
              where: { url: { in: urls } },
              select: { url: true },
            });
            const existingUrls = new Set(existing.map((item) => item.url));
            const newRawItems = rawItems.filter((item) => !existingUrls.has(item.url));
            if (newRawItems.length > 0) {
              await prisma.item.createMany({
                data: newRawItems.map((item) => ({
                  sourceId: item.sourceId,
                  title: item.title,
                  url: item.url,
                  content: item.content,
                  publishedAt: item.publishedAt,
                  imageUrls: item.imageUrls,
                })),
                skipDuplicates: true,
              });
              added = newRawItems.length;
            }
          }

          return { source: source.name, fetched: rawItems.length, added, error: undefined };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          return { source: source.name, fetched: 0, added: 0, error: msg };
        }
      }),
    );

    for (const result of results) {
      const r = result.status === "fulfilled" ? result.value : { source: "?", fetched: 0, added: 0, error: "failed" };
      total += r.fetched;
      newItems += r.added;
      if (r.error) errors.push(`${r.source}: ${r.error}`);

      onProgress({
        source: r.source,
        fetched: r.fetched,
        added: r.added,
        error: r.error,
        done: Math.min(i + BATCH_SIZE, totalSources),
        total: totalSources,
      });
    }
  }

  return { total, newItems, errors };
}
