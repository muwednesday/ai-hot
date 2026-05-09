import Parser from "rss-parser";

const parser = new Parser();

interface XSource {
  id: string;
  username: string;
  name: string;
}

/**
 * Fetch X/Twitter user timeline via RSSHub.
 * Falls back to syndication.twitter.com public JSON endpoint.
 */
export async function fetchXUser(source: XSource) {
  // Primary: RSSHub Twitter route
  try {
    const feed = await parser.parseURL(
      `https://rsshub.app/twitter/user/${source.username}`,
    );
    if (feed.items.length > 0) {
      return feed.items.map((item) => ({
        sourceId: source.id,
        title: (item.title ?? item.contentSnippet ?? "").slice(0, 100) || null,
        url:
          item.link ??
          `https://x.com/${source.username}/status/${item.guid?.split("/").pop() ?? ""}`,
        content: item.contentSnippet ?? item.content ?? null,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        imageUrls: extractXImages(item),
      }));
    }
  } catch {
    // RSSHub failed, try fallback
  }

  // Fallback: syndication.twitter.com
  try {
    const res = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${source.username}`,
      {
        headers: { "User-Agent": "AIHOT/1.0" },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return [];

    const html = await res.text();
    // Extract tweet URLs from the HTML
    const tweetUrls: string[] = [];
    const urlRegex = new RegExp(
      `https://x\\.com/${source.username}/status/(\\d+)`,
      "g",
    );
    let match;
    while ((match = urlRegex.exec(html)) !== null) {
      if (match[0] && !tweetUrls.includes(match[0])) {
        tweetUrls.push(match[0]);
      }
    }

    return tweetUrls.slice(0, 10).map((url) => ({
      sourceId: source.id,
      title: null as string | null,
      url,
      content: null as string | null,
      publishedAt: new Date(),
      imageUrls: [] as string[],
    }));
  } catch {
    return [];
  }
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
      urls.push(m[1]);
    }
  }
  return urls;
}
