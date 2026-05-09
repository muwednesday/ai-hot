import { config } from "dotenv";

// Load Supabase credentials
config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";

const source = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const dest = new PrismaClient({
  datasources: {
    db: { url: "postgresql://postgres:aihot_pg_2026@localhost:5432/aihot" },
  },
});

async function main() {
  console.log("=== 数据迁移：Supabase → 本地 Docker PostgreSQL ===\n");

  // 1. Sources
  const sources = await source.source.findMany();
  console.log(`📡 迁移 Sources: ${sources.length} 条`);
  for (const s of sources) {
    await dest.source.upsert({
      where: { slug: s.slug },
      create: {
        id: s.id,
        name: s.name,
        slug: s.slug,
        type: s.type,
        url: s.url,
        xUsername: s.xUsername,
        enabled: s.enabled,
        createdAt: s.createdAt,
      },
      update: {
        name: s.name,
        type: s.type,
        url: s.url,
        xUsername: s.xUsername,
        enabled: s.enabled,
      },
    });
  }
  console.log("  ✅ Sources 完成");

  // 2. Items (batch)
  const itemCount = await source.item.count();
  console.log(`\n📡 迁移 Items: ${itemCount} 条`);
  const BATCH = 100;
  let migrated = 0;
  for (let skip = 0; skip < itemCount; skip += BATCH) {
    const items = await source.item.findMany({
      skip,
      take: BATCH,
      orderBy: { createdAt: "asc" },
    });
    for (const item of items) {
      await dest.item.upsert({
        where: { url: item.url },
        create: {
          id: item.id,
          sourceId: item.sourceId,
          title: item.title,
          titleZh: item.titleZh,
          url: item.url,
          content: item.content,
          summaryZh: item.summaryZh,
          curatorNote: item.curatorNote,
          publishedAt: item.publishedAt,
          fetchedAt: item.fetchedAt,
          aiRelevance: item.aiRelevance,
          aiSelected: item.aiSelected,
          aiCategory: item.aiCategory,
          aiTags: item.aiTags,
          aiSummary: item.aiSummary,
          processedAt: item.processedAt,
          duplicateOfId: item.duplicateOfId,
          clusterId: item.clusterId,
          isClusterPrimary: item.isClusterPrimary,
          relatedDiscussions: item.relatedDiscussions,
          imageUrls: item.imageUrls,
          hotScore: item.hotScore,
          hotScoreUpdatedAt: item.hotScoreUpdatedAt,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        },
        update: {
          titleZh: item.titleZh,
          summaryZh: item.summaryZh,
          curatorNote: item.curatorNote,
          aiRelevance: item.aiRelevance,
          aiSelected: item.aiSelected,
          aiCategory: item.aiCategory,
          aiTags: item.aiTags,
        },
      });
    }
    migrated += items.length;
    process.stdout.write(`  进度: ${migrated}/${itemCount}\r`);
  }
  console.log(`\n  ✅ Items 完成`);

  // 3. Dailies
  const dailies = await source.daily.findMany();
  console.log(`\n📡 迁移 Dailies: ${dailies.length} 条`);
  for (const d of dailies) {
    await dest.daily.upsert({
      where: { date: d.date },
      create: {
        id: d.id,
        date: d.date,
        lead: d.lead,
        sections: d.sections,
        itemCount: d.itemCount,
        createdAt: d.createdAt,
      },
      update: {
        lead: d.lead,
        sections: d.sections,
        itemCount: d.itemCount,
      },
    });
  }
  console.log("  ✅ Dailies 完成");

  console.log("\n=== 迁移完成 ===");
}

main()
  .catch(console.error)
  .finally(async () => {
    await source.$disconnect();
    await dest.$disconnect();
  });
