import type { RawItem } from "./types";

interface WebSource {
  id: string;
  url: string;
  name: string;
  type: "anthropic" | "openai" | "generic";
}

export async function fetchWebSource(
  source: WebSource,
): Promise<RawItem[]> {
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AIHOT/1.0",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];

    const html = await res.text();

    switch (source.type) {
      case "anthropic":
        return parseAnthropic(html, source);
      case "openai":
        return parseOpenAI(html, source);
      default:
        return parseGeneric(html, source);
    }
  } catch {
    return [];
  }
}

function parseAnthropic(html: string, source: WebSource): RawItem[] {
  const items: RawItem[] = [];
  // Extract article links and titles from Anthropic research page
  const articleRegex =
    /<a[^>]+href="([^"]*)"[^>]*>[\s\S]*?<[^>]*>([^<]+)<\/[^>]+>[\s\S]*?<\/a>/gi;
  let match;
  while ((match = articleRegex.exec(html)) !== null && items.length < 10) {
    const url = match[1];
    const title = match[2]?.trim();
    if (url && title && url.startsWith("/")) {
      items.push({
        sourceId: source.id,
        title,
        url: `https://www.anthropic.com${url}`,
        content: null,
        publishedAt: new Date(),
        imageUrls: [],
      });
    }
  }
  return items;
}

function parseOpenAI(html: string, source: WebSource): RawItem[] {
  const items: RawItem[] = [];
  // Extract article links from OpenAI blog
  const linkRegex =
    /<a[^>]+href="(\/blog\/[^"]*)"[^>]*>[\s\S]*?(?:<h[23][^>]*>([^<]+)<\/h[23]>|([^<]+))[\s\S]*?<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null && items.length < 10) {
    const url = match[1];
    const title = (match[2] ?? match[3])?.trim();
    if (url && title) {
      items.push({
        sourceId: source.id,
        title,
        url: `https://openai.com${url}`,
        content: null,
        publishedAt: new Date(),
        imageUrls: [],
      });
    }
  }
  return items;
}

function parseGeneric(html: string, source: WebSource): RawItem[] {
  const items: RawItem[] = [];
  // Generic: extract links with titles
  const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([^<]{10,}?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null && items.length < 10) {
    const url = match[1];
    const title = match[2]?.trim();
    if (
      url &&
      title &&
      !url.startsWith("#") &&
      !url.startsWith("javascript:") &&
      title.length > 5
    ) {
      const fullUrl = url.startsWith("http")
        ? url
        : new URL(url, source.url).href;
      items.push({
        sourceId: source.id,
        title,
        url: fullUrl,
        content: null,
        publishedAt: new Date(),
        imageUrls: [],
      });
    }
  }
  return items;
}
