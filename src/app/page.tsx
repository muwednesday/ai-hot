import { prisma } from "@/lib/prisma";
import { CATEGORIES, groupByDate } from "@/lib/constants";
import { ItemCard } from "@/components/item-card";
import { CategoryFilter } from "@/components/category-filter";
import { SearchBar } from "@/components/search-bar";
import { DateHeader } from "@/components/date-header";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { FeedSkeleton } from "@/components/feed-skeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const category = params.category ?? undefined;
  const q = params.q ?? undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

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
          <FeedContent category={category} q={q} page={page} />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

async function FeedContent({
  category,
  q,
  page,
}: {
  category?: string;
  q?: string;
  page: number;
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

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: { source: { select: { name: true } } },
      orderBy: { publishedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.item.count({ where }),
  ]);

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-1">当前筛选条件下暂无精选内容</p>
        <p className="text-xs text-muted-foreground/60">数据每 15 分钟自动更新，请稍后再来</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
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

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(
              (p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages,
            )
            .map((p, i, arr) => (
              <span key={p}>
                {i > 0 && arr[i - 1] !== p - 1 && (
                  <span className="px-2 text-muted-foreground">...</span>
                )}
                <a
                  href={`/?${category ? `category=${category}&` : ""}${q ? `q=${q}&` : ""}page=${p}`}
                  className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-sm transition-colors ${
                    p === page
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/80"
                  }`}
                >
                  {p}
                </a>
              </span>
            ))}
        </div>
      )}
    </>
  );
}
