import type { RawItem } from "./types";

const ARXIV_API = "http://export.arxiv.org/api/query";

export async function fetchArxiv(
  sourceId: string,
  categories = ["cs.AI", "cs.CL", "cs.LG"],
): Promise<RawItem[]> {
  const query = categories.map((c) => `cat:${c}`).join("+OR+");
  const url = `${ARXIV_API}?search_query=${query}&sortBy=submittedDate&sortOrder=descending&max_results=20`;

  const res = await fetch(url, {
    headers: { Accept: "application/xml" },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  return parseArxivXml(text, sourceId);
}

function parseArxivXml(xml: string, sourceId: string): RawItem[] {
  const entries = xml.split("<entry>").slice(1);
  return entries.map((entry) => {
    const title = extractTag(entry, "title");
    const id = extractTag(entry, "id");
    const summary = extractTag(entry, "summary");
    const published = extractTag(entry, "published");
    return {
      sourceId,
      title: title?.replace(/\s+/g, " ").trim() ?? null,
      url: id?.replace("/abs/", "/pdf/") ?? id ?? "",
      content: summary?.replace(/\s+/g, " ").trim() ?? null,
      publishedAt: published ? new Date(published) : new Date(),
      imageUrls: [],
    };
  });
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "s");
  return xml.match(re)?.[1]?.trim() ?? null;
}
