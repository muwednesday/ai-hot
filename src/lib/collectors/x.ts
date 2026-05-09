import Parser from "rss-parser";

const parser = new Parser({ timeout: 10000 });

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface XSource {
  id: string;
  username: string;
  name: string;
}

export async function fetchXUser(source: XSource) {
  const nitterUrl = `https://nitter.net/${source.username}/rss`;
  const res = await fetch(nitterUrl, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  const feed = await parser.parseString(text);

  return feed.items.slice(0, 20).map((item) => {
    const link = (item.link ?? "").replace(/nitter\.net/g, "x.com");
    return {
      sourceId: source.id,
      title: (item.title ?? item.contentSnippet ?? "").slice(0, 200) || null,
      url: link,
      content: (item.contentSnippet ?? item.content ?? "").slice(0, 2000) || null,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      imageUrls: extractXImages(item),
    };
  });
}

function extractXImages(item: Parser.Item & Record<string, unknown>): string[] {
  const urls: string[] = [];
  const enclosures = item.enclosure as
    | { url?: string; type?: string }
    | undefined;
  if (enclosures?.url && enclosures.type?.startsWith("image/")) {
    urls.push(enclosures.url);
  }
  const content = (item.content as string) ?? "";
  const matches = content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
  for (const m of matches) {
    if (m[1] && !m[1].includes("emoji") && !m[1].includes("profile_images")) {
      urls.push(m[1].replace(/nitter\.net\/pic\//g, ""));
    }
  }
  return urls;
}
