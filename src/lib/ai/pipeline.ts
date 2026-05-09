import { prisma } from "@/lib/prisma";
import { deepseekJson } from "./deepseek";
import { AI_SCORE_SYSTEM, AI_SCORE_USER } from "./prompts";

interface AiScoreResult {
  relevance: number;
  category: string;
  tags: string[];
  selected: boolean;
  titleZh: string;
  summaryZh: string;
  curatorNote: string;
}

export async function processUnscoredItems(batchSize = 10): Promise<{
  processed: number;
  selected: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;
  let selected = 0;

  const items = await prisma.item.findMany({
    where: {
      aiRelevance: null,
      duplicateOfId: null,
    },
    include: { source: true },
    take: batchSize,
    orderBy: { publishedAt: "desc" },
  });

  if (items.length === 0) return { processed: 0, selected: 0, errors: [] };

  for (const item of items) {
    try {
      const result = await deepseekJson<AiScoreResult>(
        AI_SCORE_USER({
          title: item.title,
          content: item.content,
          sourceName: item.source.name,
        }),
        AI_SCORE_SYSTEM,
      );

      await prisma.item.update({
        where: { id: item.id },
        data: {
          aiRelevance: result.relevance,
          aiCategory: result.category,
          aiTags: result.tags,
          aiSelected: result.selected && result.relevance >= 75,
          titleZh: result.titleZh,
          summaryZh: result.summaryZh,
          curatorNote: result.curatorNote || null,
          processedAt: new Date(),
        },
      });

      processed++;
      if (result.selected && result.relevance >= 75) selected++;

      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      errors.push(
        `Item ${item.id}: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }

  return { processed, selected, errors };
}
