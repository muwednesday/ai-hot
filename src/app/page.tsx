import { prisma } from "@/lib/prisma";
import { ItemCard } from "@/components/item-card";
import { CategoryFilter } from "@/components/category-filter";
import { SearchBar } from "@/components/search-bar";
import { DateHeader } from "@/components/date-header";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { FeedSkeleton } from "@/components/feed-skeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { slug: null, label: "全部" },
  { slug: "ai-models", label: "模型" },
  { slug: "ai-products", label: "产品" },
  { slug: "industry", label: "行业" },
  { slug: "paper", label: "论文" },
  { slug: "tip", label: "技巧" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const category = params.category ?? undefined;
  const q = params.q ?? undefined;

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 flex-1 w-full">
        <div className="mb-5">
          <h1 className="text-xl font-bold mb-0.5">精选</h1>
          <p className="text-sm text-muted-foreground">
            AI 自动挑选的高价值内容
          </p>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Suspense>
            <CategoryFilter categories={CATEGORIES} active={category} />
          </Suspense>
        </div>
        <div className="mb-5">
          <SearchBar defaultValue={q} />
        </div>

        <Suspense fallback={<FeedSkeleton />}>
          <FeedContent category={category} q={q} />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

async function FeedContent({
  category,
  q,
}: {
  category?: string;
  q?: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    aiSelected: true,
    duplicateOfId: null,
  };
  if (category) where.aiCategory = category;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { titleZh: { contains: q, mode: "insensitive" } },
      { summaryZh: { contains: q, mode: "insensitive" } },
    ];
  }

  const items = await prisma.item.findMany({
    where,
    include: { source: { select: { name: true } } },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-1">当前筛选条件下暂无精选内容</p>
        <p className="text-xs text-muted-foreground/60">数据每 15 分钟自动更新，请稍后再来</p>
      </div>
    );
  }

  const grouped = groupByDate(items);

  return (
    <>
      {Object.entries(grouped).map(([date, dateItems]) => (
        <section key={date} className="mb-6">
          <DateHeader date={date} />
          <div className="space-y-3 mt-3">
            {dateItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupByDate(items: any[]) {
  const map: Record<string, any[]> = {};
  for (const item of items) {
    const date = new Date(item.publishedAt).toLocaleDateString("zh-CN", {
      month: "long",
      day: "numeric",
    });
    if (!map[date]) map[date] = [];
    map[date].push(item);
  }
  return map;
}
