import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "selected";
  const category = searchParams.get("category");
  const since = searchParams.get("since");
  const q = searchParams.get("q");
  const take = Math.min(parseInt(searchParams.get("take") ?? "50", 10), 100);
  const cursor = searchParams.get("cursor");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { duplicateOfId: null };

  if (mode === "selected") {
    where.aiSelected = true;
  } else {
    where.aiRelevance = { gte: 60 };
  }

  if (category) where.aiCategory = category;

  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      where.publishedAt = { gte: sinceDate };
    }
  }

  if (q && q.length >= 2) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { titleZh: { contains: q, mode: "insensitive" } },
      { summaryZh: { contains: q, mode: "insensitive" } },
    ];
  }

  if (cursor) {
    where.id = { lt: cursor };
  }

  const items = await prisma.item.findMany({
    where,
    include: { source: { select: { name: true, slug: true } } },
    orderBy: { publishedAt: "desc" },
    take: take + 1,
  });

  const hasMore = items.length > take;
  const resultItems = hasMore ? items.slice(0, take) : items;
  const nextCursor = hasMore ? resultItems[resultItems.length - 1].id : null;

  return NextResponse.json({
    items: resultItems,
    nextCursor,
    hasMore,
  });
}
