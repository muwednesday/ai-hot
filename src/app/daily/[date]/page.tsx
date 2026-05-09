import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export const dynamic = "force-dynamic";

export default async function DailyDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) notFound();

  const startOfDay = new Date(dateObj);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(dateObj);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const daily = await prisma.daily.findFirst({
    where: {
      date: { gte: startOfDay, lte: endOfDay },
    },
  });

  if (!daily) notFound();

  const sections = daily.sections as {
    label: string;
    items: string[];
  }[];
  const lead = daily.lead as { title: string; summary: string };

  const allItemIds = sections.flatMap((s) => s.items);
  const items = await prisma.item.findMany({
    where: { id: { in: allItemIds } },
    include: { source: { select: { name: true } } },
  });
  const itemMap = new Map(items.map((i) => [i.id, i]));

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 flex-1">
        <Link
          href="/daily"
          className="text-sm text-muted-foreground hover:text-primary mb-4 block"
        >
          &larr; 返回日报列表
        </Link>

        <h1 className="text-xl font-bold mb-2">AI 日报</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {new Date(daily.date).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <Card className="p-5 mb-6 bg-primary/5 border-primary/20">
          <h2 className="font-semibold mb-2">{lead.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lead.summary}
          </p>
        </Card>

        {sections.map((section) => (
          <section key={section.label} className="mb-6">
            <h2 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
              {section.label}
            </h2>
            <div className="space-y-2">
              {section.items.map((itemId) => {
                const item = itemMap.get(itemId);
                if (!item) return null;
                return (
                  <Link
                    key={itemId}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg hover:bg-secondary/60 transition-colors"
                  >
                    <div className="text-sm font-medium">
                      {item.titleZh ?? item.title}
                    </div>
                    {item.summaryZh && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.summaryZh}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground mt-1.5">
                      {item.source.name}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
