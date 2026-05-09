import Parser from "rss-parser";

const parser = new Parser({ timeout: 15000 });

interface RssSource {
  id: string;
  url: string;
  name: string;
}

export async function fetchRssSource(source: RssSource) {
  const feed = await parser.parseURL(source.url);
  return feed.items.map((item) => ({
    sourceId: source.id,
    title: item.title ?? null,
    url: item.link ?? "",
    content: item.contentSnippet ?? item.content ?? null,
    publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
    imageUrls: extractImages(item),
  }));
}

function extractImages(
  item: Parser.Item & Record<string, unknown>,
): string[] {
  const urls: string[] = [];
  const content =
    (item.content as string) ??
    (item["content:encoded"] as string) ??
    "";
  if (typeof content === "string") {
    const matches = content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
    for (const m of matches) {
      if (m[1]) urls.push(m[1]);
    }
  }
  return urls;
}
