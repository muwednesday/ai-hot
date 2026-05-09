import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const latestDaily = await prisma.daily.findFirst({
    orderBy: { date: "desc" },
  });

  if (!latestDaily) {
    return (
      <>
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-6 flex-1">
          <h1 className="text-xl font-bold mb-4">AI 日报</h1>
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-1">暂无日报</p>
            <p className="text-xs text-muted-foreground/60">日报将在有足够精选内容后自动生成</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const sections = latestDaily.sections as {
    label: string;
    items: string[];
  }[];
  const lead = latestDaily.lead as { title: string; summary: string };

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
        <h1 className="text-xl font-bold mb-2">AI 日报</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {new Date(latestDaily.date).toLocaleDateString("zh-CN", {
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
