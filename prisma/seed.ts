import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local", override: true });
config({ path: ".env", override: false });

const prisma = new PrismaClient();

async function main() {
  const sources = [
    // X/Twitter via Nitter RSS
    { name: "Garry Tan", slug: "garrytan-x", type: "x_user", xUsername: "garrytan" },
    { name: "Andrew Ng", slug: "andrewyng-x", type: "x_user", xUsername: "AndrewYNg" },
    { name: "a16z", slug: "a16z-x", type: "x_user", xUsername: "a16z" },
    { name: "OpenAI", slug: "openai-x", type: "x_user", xUsername: "OpenAI" },
    { name: "Anthropic", slug: "anthropic-x", type: "x_user", xUsername: "AnthropicAI" },
    { name: "Sam Altman", slug: "sama-x", type: "x_user", xUsername: "sama" },
    { name: "Andrej Karpathy", slug: "karpathy-x", type: "x_user", xUsername: "karpathy" },
    { name: "Boris Cherny", slug: "bcherny-x", type: "x_user", xUsername: "bcherny" },
    { name: "Terry Rodriguez", slug: "trq212-x", type: "x_user", xUsername: "trq212" },
    { name: "Lex Fridman", slug: "lexfridman-x", type: "x_user", xUsername: "lexfridman" },
    { name: "Geoffrey Hinton", slug: "hinton-x", type: "x_user", xUsername: "geoffreyhinton" },
    { name: "Margaret Mitchell", slug: "mmitchell-x", type: "x_user", xUsername: "mmitchell_ai" },
    { name: "Raju PP", slug: "rajupp-x", type: "x_user", xUsername: "rajupp" },
    { name: "Yoav Goldberg", slug: "yoavgo-x", type: "x_user", xUsername: "yoavgo" },
    { name: "hardmaru", slug: "hardmaru-x", type: "x_user", xUsername: "hardmaru" },
    { name: "Mikko Hyppönen", slug: "mikko-x", type: "x_user", xUsername: "mikko" },

    // RSS sources
    { name: "GitHub Blog", slug: "github-blog", type: "rss", url: "https://github.blog/feed/" },
    { name: "BAIR Blog", slug: "bair-blog", type: "rss", url: "https://bair.berkeley.edu/blog/feed.xml" },
    { name: "TechCrunch AI", slug: "tc-ai", type: "rss", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
    { name: "量子位", slug: "qbitai", type: "rss", url: "https://www.qbitai.com/feed" },
    { name: "Claude Code Releases", slug: "claude-code-releases", type: "rss", url: "https://github.com/anthropics/claude-code/releases.atom" },

    // Aggregated sources
    { name: "Hacker News", slug: "hn", type: "hn" },
    { name: "arXiv AI", slug: "arxiv-ai", type: "arxiv" },
  ];

  // Disable old sources not in the new list
  const newSlugs = new Set(sources.map(s => s.slug));
  const oldSources = await prisma.source.findMany({ where: { slug: { notIn: Array.from(newSlugs) } } });
  if (oldSources.length > 0) {
    await prisma.source.updateMany({
      where: { slug: { notIn: Array.from(newSlugs) } },
      data: { enabled: false },
    });
    console.log(`已禁用 ${oldSources.length} 个旧源: ${oldSources.map(s => s.name).join(", ")}`);
  }

  for (const source of sources) {
    await prisma.source.upsert({
      where: { slug: source.slug },
      create: source,
      update: source,
    });
  }

  const active = await prisma.source.count({ where: { enabled: true } });
  console.log(`Seeded ${sources.length} sources, 共 ${active} 个活跃`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
