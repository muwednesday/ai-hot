import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local", override: true });
config({ path: ".env", override: false });

const prisma = new PrismaClient();

async function main() {
  const sources = [
    // X/Twitter via RSSHub
    {
      name: "Rohan Paul",
      slug: "rohanpaul-x",
      type: "x_user",
      xUsername: "rohanpaul_ai",
    },
    {
      name: "Jim Fan",
      slug: "jimfan-x",
      type: "x_user",
      xUsername: "DrJimFan",
    },
    {
      name: "Berryxia.AI",
      slug: "berryxia-x",
      type: "x_user",
      xUsername: "berryxia",
    },
    {
      name: "宝玉",
      slug: "dotey-x",
      type: "x_user",
      xUsername: "dotey",
    },
    {
      name: "歸藏",
      slug: "guizang-x",
      type: "x_user",
      xUsername: "op7418",
    },
    {
      name: "阿绎 AYi",
      slug: "ayi-x",
      type: "x_user",
      xUsername: "AYi_AInotes",
    },
    {
      name: "向阳乔木",
      slug: "vista8-x",
      type: "x_user",
      xUsername: "vista8",
    },
    {
      name: "邵猛",
      slug: "shaomeng-x",
      type: "x_user",
      xUsername: "shao__meng",
    },
    {
      name: "Ant Ling",
      slug: "antling-x",
      type: "x_user",
      xUsername: "AntLingAGI",
    },
    {
      name: "小互",
      slug: "xiaohu-x",
      type: "x_user",
      xUsername: "xiaohu",
    },
    {
      name: "OpenAI",
      slug: "openai-x",
      type: "x_user",
      xUsername: "OpenAI",
    },
    {
      name: "Anthropic",
      slug: "anthropic-x",
      type: "x_user",
      xUsername: "AnthropicAI",
    },

    // RSS sources
    {
      name: "IT之家",
      slug: "ithome",
      type: "rss",
      url: "https://rsshub.app/ithome",
    },
    {
      name: "机器之心",
      slug: "jiqizhixin",
      type: "rss",
      url: "https://rsshub.app/jiqizhixin/latest",
    },
    {
      name: "量子位",
      slug: "qbitai",
      type: "rss",
      url: "https://rsshub.app/qbitai",
    },
    {
      name: "Hugging Face Blog",
      slug: "huggingface-blog",
      type: "rss",
      url: "https://huggingface.co/blog/feed.xml",
    },
    {
      name: "GitHub Blog",
      slug: "github-blog",
      type: "rss",
      url: "https://github.blog/feed/",
    },
    {
      name: "BAIR Blog",
      slug: "bair-blog",
      type: "rss",
      url: "https://bair.berkeley.edu/blog/feed.xml",
    },
    {
      name: "HN 中文翻译",
      slug: "buzzing-hn",
      type: "rss",
      url: "https://www.buzzing.cc/feed",
    },
    {
      name: "The Verge AI",
      slug: "verge-ai",
      type: "rss",
      url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml",
    },
    {
      name: "TechCrunch AI",
      slug: "tc-ai",
      type: "rss",
      url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    },
    {
      name: "Claude Code Releases",
      slug: "claude-code-releases",
      type: "rss",
      url: "https://github.com/anthropics/claude-code/releases.atom",
    },

    // Aggregated sources
    { name: "Hacker News", slug: "hn", type: "hn" },
    { name: "arXiv AI", slug: "arxiv-ai", type: "arxiv" },
  ];

  for (const source of sources) {
    await prisma.source.upsert({
      where: { slug: source.slug },
      create: source,
      update: source,
    });
  }

  console.log(`Seeded ${sources.length} sources`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
