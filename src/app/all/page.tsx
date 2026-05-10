import { prisma } from "@/lib/prisma";
import { CATEGORIES, groupByDate } from "@/lib/constants";
import { ItemCard } from "@/components/item-card";
import { CategoryFilter } from "@/components/category-filter";
import { SearchBar } from "@/components/search-bar";
import { DateHeader } from "@/components/date-header";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export const dynamic = "force-dynamic";

export default async function AllPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const category = params.category;
  const q = params.q;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 30;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    aiRelevance: { gte: 60 },
    duplicateOfId: null,
  };
  if (category) where.aiCategory = category;
  if (q && q.length >= 2) {
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
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.item.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 flex-1 w-full">
        <h1 className="text-xl font-bold mb-4">全部 AI 动态</h1>
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          <CategoryFilter categories={CATEGORIES} active={category} basePath="/all" />
        </div>
        <div className="mb-5">
          <SearchBar defaultValue={q} basePath="/all" />
        </div>

        <div className="space-y-3">
          {Object.entries(groupByDate(items)).map(([date, dateItems]) => (
            <section key={date} className="mb-6">
              <DateHeader date={date} />
              <div className="space-y-3 mt-3">
                {dateItems.map((item: any) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {items.length === 0 && (
          <p className="text-center text-muted-foreground py-16">
            当前筛选条件下暂无内容
          </p>
        )}

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
                    href={`/all?${category ? `category=${category}&` : ""}${q ? `q=${q}&` : ""}page=${p}`}
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
      </main>
      <Footer />
    </>
  );
}
