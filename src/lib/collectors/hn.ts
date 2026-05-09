import type { RawItem } from "./types";

const HN_API = "https://hacker-news.firebaseio.com/v0";

const AI_KEYWORDS = [
  "ai",
  "ml",
  "llm",
  "gpt",
  "claude",
  "model",
  "neural",
  "deep learning",
  "machine learning",
  "transformer",
  "diffusion",
  "openai",
  "anthropic",
  "deepseek",
  "gemini",
  "copilot",
  "agent",
  "embedding",
  "rag",
  "rlhf",
  "moe",
  "mixture of experts",
];

export async function fetchHackerNews(sourceId: string): Promise<RawItem[]> {
  const topRes = await fetch(`${HN_API}/topstories.json`);
  const ids: number[] = await topRes.json();
  const top50 = ids.slice(0, 50);

  const items = await Promise.all(
    top50.map(async (id) => {
      try {
        const res = await fetch(`${HN_API}/item/${id}.json`);
        const item = await res.json();
        return { id, ...item };
      } catch {
        return null;
      }
    }),
  );

  // Filter for AI-related items
  return items
    .filter((item): item is NonNullable<typeof item> & { title: string } => {
      if (!item?.title) return false;
      const lower = (item.title as string).toLowerCase();
      return AI_KEYWORDS.some((kw) => lower.includes(kw));
    })
    .slice(0, 30)
    .map((item) => ({
      sourceId,
      title: item.title ?? null,
      url:
        (item.url as string) ??
        `https://news.ycombinator.com/item?id=${item.id}`,
      content: (item.text as string) ?? null,
      publishedAt: new Date(((item.time as number) ?? 0) * 1000),
      imageUrls: [],
      metadata: {
        score: item.score,
        descendants: item.descendants,
      },
    }));
}
