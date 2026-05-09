import { prisma } from "@/lib/prisma";
import { deepseekJson } from "./deepseek";
import { DAILY_REPORT_SYSTEM, DAILY_REPORT_USER, DAILY_SECTIONS } from "./prompts";

export async function generateDailyReport(date?: Date) {
  const reportDate = date ?? new Date();
  reportDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(reportDate);
  endDate.setUTCHours(23, 59, 59, 999);

  const items = await prisma.item.findMany({
    where: {
      aiSelected: true,
      publishedAt: { gte: reportDate, lte: endDate },
    },
    orderBy: { hotScore: "desc" },
  });

  if (items.length === 0) return null;

  const sections = DAILY_SECTIONS.map(({ label, key }) => ({
    label,
    items: items
      .filter((i) => i.aiCategory === key)
      .map((i) => ({
        id: i.id,
        titleZh: i.titleZh,
        summaryZh: i.summaryZh,
        url: i.url,
        curatorNote: i.curatorNote,
      })),
  })).filter((s) => s.items.length > 0);

  if (sections.length === 0) return null;

  const result = await deepseekJson<{
    leadTitle: string;
    leadSummary: string;
    sections: { label: string; items: string[] }[];
  }>(DAILY_REPORT_USER(reportDate.toISOString().split("T")[0], sections), DAILY_REPORT_SYSTEM);

  const daily = await prisma.daily.create({
    data: {
      date: reportDate,
      lead: { title: result.leadTitle, summary: result.leadSummary },
      sections: result.sections,
      itemCount: items.length,
    },
  });

  return daily;
}
