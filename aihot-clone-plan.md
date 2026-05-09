# AI 热点聚合站 — 零成本完整实施方案

> **For Claude Code:** 按 Task 顺序逐个执行。每个 Task 用 TDD：先写测试 → 跑通 → 实现 → 跑通 → commit。

**目标：** 克隆 aihot.virxact.com 核心功能 —— AI 驱动的中文 AI 行业资讯聚合站，零成本上线。

**架构：** Next.js 15 App Router + Supabase PostgreSQL + Prisma + DeepSeek V4 Flash + Vercel 部署。

**零成本栈：**
| 组件 | 方案 | 费用 |
|---|---|---|
| 前端 + API | Next.js 15 App Router | Vercel Hobby 免费 |
| 数据库 | Supabase PostgreSQL | 免费 500MB |
| ORM | Prisma | 开源免费 |
| AI 处理 | DeepSeek V4 Flash (自有 key) | ~¥0.5/天 (极低) |
| CSS | Tailwind CSS + shadcn/ui | 开源免费 |
| 定时任务 | Vercel Cron (1免费) + GitHub Actions | 免费 |
| 部署 | Vercel | 免费 |
| 域名 | Vercel 自带 `*.vercel.app` | 免费 |
| X/Twitter 数据 | X API v2 Free | 1500 条/月 |
| 其他信源 | HN API / arXiv API / RSS | 全部免费 |

---

## 项目初始化

### Task 0: 创建项目骨架

**目标：** 初始化 Next.js 项目 + 依赖安装 + Supabase 建库 + Prisma schema

**Step 1：创建 Next.js 项目**

```bash
npx create-next-app@latest aihot --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd aihot
```

**Step 2：安装依赖**

```bash
npm install prisma @prisma/client @supabase/supabase-js next-themes lucide-react class-variance-authority clsx tailwind-merge @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-avatar date-fns feed rss-parser
npm install -D @types/rss-parser
npx prisma init
npx shadcn@latest init
npx shadcn@latest add button card tabs dialog dropdown-menu avatar input badge separator skeleton
```

**Step 3：Supabase 建库**

1. 去 https://supabase.com 注册，创建项目
2. 在 Settings → Database 获取连接字符串
3. 写入 `.env.local`：

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres"
DEEPSEEK_API_KEY="sk-your-deepseek-api-key"
DEEPSEEK_MODEL="deepseek-v4-flash"
X_BEARER_TOKEN="your_x_api_bearer_token"
CRON_SECRET="random_string_for_cron_endpoint_auth"
```

**Step 4：Prisma Schema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Source {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  type      String   // "x_user", "rss", "hn", "arxiv"
  url       String?
  xUsername String?
  enabled   Boolean  @default(true)
  items     Item[]
  createdAt DateTime @default(now())
}

model Item {
  id              String    @id @default(cuid())
  sourceId        String
  source          Source    @relation(fields: [sourceId], references: [id])
  title           String?
  titleZh         String?
  url             String    @unique
  content         String?
  summaryZh       String?
  curatorNote     String?
  publishedAt     DateTime
  fetchedAt       DateTime  @default(now())
  
  // AI 评分
  aiRelevance     Int?
  aiSelected      Boolean   @default(false)
  aiCategory      String?   // "ai-models", "ai-products", "industry", "paper", "tip"
  aiTags          String[]  @default([])
  aiSummary       String?
  
  // 聚类去重
  duplicateOfId   String?
  clusterId       String?
  isClusterPrimary Boolean  @default(false)
  
  // 图片
  imageUrls       String[]  @default([])
  
  // 热度
  hotScore        Int       @default(0)
  hotScoreUpdatedAt DateTime?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([publishedAt(sort: Desc)])
  @@index([aiSelected, publishedAt(sort: Desc)])
  @@index([aiCategory, publishedAt(sort: Desc)])
  @@index([sourceId])
  @@index([duplicateOfId])
}

model Daily {
  id        String    @id @default(cuid())
  date      DateTime  @unique
  lead      Json      // { title, summary }
  sections  Json      // [{ label, items: [...itemIds] }]
  itemCount Int
  createdAt DateTime  @default(now())

  @@index([date(sort: Desc)])
}
```

**Step 5：初始化数据库**

```bash
npx prisma db push
npx prisma generate
```

**Step 6：初始化 shadcn/ui**

`src/lib/utils.ts` — shadcn 会自动生成。

**验证：** `npm run dev` 打开 http://localhost:3000 看到 Next.js 欢迎页。

---

## Phase 1: 数据采集引擎

### Task 1.1: 创建采集器基类和 RSS 采集器

**目标：** 拉取 RSS 源数据，解析并存入数据库

**文件：**
- 创建: `src/lib/collectors/base.ts`
- 创建: `src/lib/collectors/rss.ts`
- 创建: `src/lib/collectors/types.ts`

`src/lib/collectors/types.ts`:

```typescript
export interface RawItem {
  sourceId: string
  title: string | null
  url: string
  content: string | null
  publishedAt: Date
  imageUrls: string[]
  metadata?: Record<string, unknown>
}

export interface Collector {
  name: string
  fetch(): Promise<RawItem[]>
}
```

`src/lib/collectors/rss.ts`:

```typescript
import Parser from 'rss-parser'

type RssParser = Parser<Record<string, unknown>>

const parser: RssParser = new Parser()

interface RssSource {
  id: string
  url: string
  name: string
}

export async function fetchRssSource(source: RssSource): Promise<RawItem[]> {
  const feed = await parser.parseURL(source.url)
  return feed.items.map((item) => ({
    sourceId: source.id,
    title: item.title ?? null,
    url: item.link ?? '',
    content: item.contentSnippet ?? item.content ?? null,
    publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
    imageUrls: extractImages(item),
  }))
}

function extractImages(item: Parser.Item & Record<string, unknown>): string[] {
  const urls: string[] = []
  const content = item.content ?? item['content:encoded'] ?? ''
  if (typeof content === 'string') {
    const matches = content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)
    for (const m of matches) {
      if (m[1]) urls.push(m[1])
    }
  }
  return urls
}
```

**Step 1: 写测试** `src/lib/collectors/__tests__/rss.test.ts`

```typescript
import { describe, it, expect } from 'vitest'

describe('RSS collector', () => {
  it('parses RSS items with correct shape', async () => {
    // Mock RSS feed with known content
    // Test that items have required fields
  })
})
```

**Step 2:** 运行 `npm test` 确认失败
**Step 3:** 实现采集器代码
**Step 4:** 运行 `npm test` 确认通过
**Step 5:** `git add -A && git commit -m "feat: add RSS collector"`

---

### Task 1.2: X/Twitter API 采集器

**目标：** 拉取指定 X 账号的最新推文

**文件：** `src/lib/collectors/x.ts`

```typescript
const X_API_BASE = 'https://api.x.com/2'

interface XSource {
  id: string
  username: string
  name: string
}

export async function fetchXUser(source: XSource): Promise<RawItem[]> {
  const BEARER = process.env.X_BEARER_TOKEN!
  
  // Step 1: get user id
  const userRes = await fetch(
    `${X_API_BASE}/users/by/username/${source.username}`,
    { headers: { Authorization: `Bearer ${BEARER}` } }
  )
  const userData = await userRes.json()
  const userId = userData.data?.id
  if (!userId) return []

  // Step 2: get recent tweets
  const tweetsRes = await fetch(
    `${X_API_BASE}/users/${userId}/tweets?` + new URLSearchParams({
      max_results: '10',
      'tweet.fields': 'created_at,attachments,entities',
      'media.fields': 'url,preview_image_url',
      expansions: 'attachments.media_keys',
    }),
    { headers: { Authorization: `Bearer ${BEARER}` } }
  )
  const tweetsData = await tweetsRes.json()
  if (!tweetsData.data) return []

  const mediaMap = new Map<string, string>()
  if (tweetsData.includes?.media) {
    for (const m of tweetsData.includes.media) {
      if (m.url || m.preview_image_url) {
        mediaMap.set(m.media_key, m.url ?? m.preview_image_url)
      }
    }
  }

  return tweetsData.data.map((t: Record<string, unknown>) => ({
    sourceId: source.id,
    title: (t.text as string)?.slice(0, 100) ?? null,
    url: `https://x.com/${source.username}/status/${t.id}`,
    content: t.text as string ?? null,
    publishedAt: new Date(t.created_at as string),
    imageUrls: extractXImages(t, mediaMap),
  }))
}

function extractXImages(
  tweet: Record<string, unknown>,
  mediaMap: Map<string, string>
): string[] {
  const urls: string[] = []
  const keys = (tweet.attachments as Record<string, string[]>)?.media_keys ?? []
  for (const key of keys) {
    const url = mediaMap.get(key)
    if (url) urls.push(url)
  }
  return urls
}
```

**验证：** `npm test` 确认 X 采集器测试通过。

---

### Task 1.3: Hacker News + arXiv 采集器

**HN 文件：** `src/lib/collectors/hn.ts`

```typescript
const HN_API = 'https://hacker-news.firebaseio.com/v0'

export async function fetchHackerNews(sourceId: string): Promise<RawItem[]> {
  const topRes = await fetch(`${HN_API}/topstories.json`)
  const ids: number[] = await topRes.json()
  const top30 = ids.slice(0, 30)

  const items = await Promise.all(
    top30.map(async (id) => {
      const res = await fetch(`${HN_API}/item/${id}.json`)
      const item = await res.json()
      return {
        sourceId,
        title: item.title ?? null,
        url: item.url ?? `https://news.ycombinator.com/item?id=${id}`,
        content: item.text ?? null,
        publishedAt: new Date((item.time ?? 0) * 1000),
        imageUrls: [] as string[],
        metadata: { score: item.score, descendants: item.descendants },
      }
    })
  )
  return items
}
```

**arXiv 文件：** `src/lib/collectors/arxiv.ts`

```typescript
const ARXIV_API = 'http://export.arxiv.org/api/query'

export async function fetchArxiv(
  sourceId: string,
  categories = ['cs.AI', 'cs.CL', 'cs.LG'],
): Promise<RawItem[]> {
  const query = categories.map((c) => `cat:${c}`).join('+OR+')
  const url = `${ARXIV_API}?search_query=${query}&sortBy=submittedDate&sortOrder=descending&max_results=20`
  
  const res = await fetch(url)
  const text = await res.text()
  return parseArxivXml(text, sourceId)
}

function parseArxivXml(xml: string, sourceId: string): RawItem[] {
  const entries = xml.split('<entry>').slice(1)
  return entries.map((entry) => {
    const title = extractTag(entry, 'title')
    const id = extractTag(entry, 'id')
    const summary = extractTag(entry, 'summary')
    const published = extractTag(entry, 'published')
    return {
      sourceId,
      title: title?.replace(/\s+/g, ' ').trim() ?? null,
      url: id ?? '',
      content: summary?.replace(/\s+/g, ' ').trim() ?? null,
      publishedAt: published ? new Date(published) : new Date(),
      imageUrls: [],
    }
  })
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's')
  return xml.match(re)?.[1]?.trim() ?? null
}
```

---

### Task 1.4: 采集调度器 — 批量拉取 + 去重入库

**目标：** 统一调度所有采集源，去重后写入数据库

**文件：** `src/lib/collectors/scheduler.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { fetchRssSource } from './rss'
import { fetchXUser } from './x'
import { fetchHackerNews } from './hn'
import { fetchArxiv } from './arxiv'
import type { RawItem } from './types'

export async function runAllCollectors(): Promise<{
  total: number
  newItems: number
  errors: string[]
}> {
  const errors: string[] = []
  let total = 0
  let newItems = 0

  // 获取所有启用的信源
  const sources = await prisma.source.findMany({
    where: { enabled: true },
  })

  for (const source of sources) {
    try {
      let rawItems: RawItem[] = []
      
      switch (source.type) {
        case 'rss':
          if (source.url) rawItems = await fetchRssSource({
            id: source.id, url: source.url, name: source.name,
          })
          break
        case 'x_user':
          if (source.xUsername) rawItems = await fetchXUser({
            id: source.id, username: source.xUsername, name: source.name,
          })
          break
        case 'hn':
          rawItems = await fetchHackerNews(source.id)
          break
        case 'arxiv':
          rawItems = await fetchArxiv(source.id)
          break
      }

      total += rawItems.length
      
      // 去重：按 url 检查是否已存在
      const urls = rawItems.map((i) => i.url)
      const existing = await prisma.item.findMany({
        where: { url: { in: urls } },
        select: { url: true },
      })
      const existingUrls = new Set(existing.map((i) => i.url))
      
      const newRawItems = rawItems.filter((i) => !existingUrls.has(i.url))
      
      if (newRawItems.length > 0) {
        await prisma.item.createMany({
          data: newRawItems.map((i) => ({
            sourceId: i.sourceId,
            title: i.title,
            url: i.url,
            content: i.content,
            publishedAt: i.publishedAt,
            imageUrls: i.imageUrls,
          })),
          skipDuplicates: true,
        })
        newItems += newRawItems.length
      }
    } catch (e) {
      errors.push(`${source.name}: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  return { total, newItems, errors }
}
```

**Prisma client 文件：** `src/lib/prisma.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

---

### Task 1.5: 初始化信源 Seed 数据

**文件：** `prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const sources = [
    // X/Twitter 信源
    { name: 'OpenAI', slug: 'openai-x', type: 'x_user', xUsername: 'OpenAI' },
    { name: 'Anthropic', slug: 'anthropic-x', type: 'x_user', xUsername: 'AnthropicAI' },
    { name: 'Google DeepMind', slug: 'deepmind-x', type: 'x_user', xUsername: 'GoogleDeepMind' },
    { name: 'Andrej Karpathy', slug: 'karpathy-x', type: 'x_user', xUsername: 'karpathy' },
    { name: 'Yann LeCun', slug: 'lecun-x', type: 'x_user', xUsername: 'ylecun' },
    { name: 'Jim Fan', slug: 'jimfan-x', type: 'x_user', xUsername: 'DrJimFan' },
    { name: 'Emad Mostaque', slug: 'emad-x', type: 'x_user', xUsername: 'EMostaque' },
    { name: 'Elon Musk', slug: 'elon-x', type: 'x_user', xUsername: 'elonmusk' },
    { name: 'Sam Altman', slug: 'sama-x', type: 'x_user', xUsername: 'sama' },
    { name: 'Meta AI', slug: 'metaai-x', type: 'x_user', xUsername: 'AIatMeta' },

    // RSS 信源
    { name: '机器之心', slug: 'jiqizhixin', type: 'rss', url: 'https://rsshub.app/jiqizhixin/latest' },
    { name: '量子位', slug: 'liangziwei', type: 'rss', url: 'https://rsshub.app/qbitai' },
    { name: 'IT之家', slug: 'ithome', type: 'rss', url: 'https://rsshub.app/ithome' },
    { name: 'The Verge AI', slug: 'verge-ai', type: 'rss', url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml' },
    { name: 'TechCrunch AI', slug: 'tc-ai', type: 'rss', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },

    // 聚合源
    { name: 'Hacker News', slug: 'hn', type: 'hn' },
    { name: 'arXiv AI', slug: 'arxiv-ai', type: 'arxiv' },
  ]

  for (const source of sources) {
    await prisma.source.upsert({
      where: { slug: source.slug },
      create: source,
      update: source,
    })
  }

  console.log(`✅ Seeded ${sources.length} sources`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**执行 seed：**

```bash
# package.json 已经有 "prisma": { "seed": "tsx prisma/seed.ts" }
npx tsx prisma/seed.ts
```

---

### Task 1.6: 采集 API 端点 + Cron 配置

**目标：** 创建 Vercel Cron 触发的采集端点

**文件：** `src/app/api/cron/collect/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { runAllCollectors } from '@/lib/collectors/scheduler'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await runAllCollectors()
  return NextResponse.json({
    success: true,
    ...result,
    timestamp: new Date().toISOString(),
  })
}
```

**Vercel Cron 配置：** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/collect",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

> ⚠️ Vercel Hobby 只支持 1 个 cron job。我们把这 1 个给采集，AI 处理用 GitHub Actions 补充。

---

## Phase 2: AI 处理管线

这是整个项目的核心 —— 用 DeepSeek V4 Flash API 处理内容。

### Task 2.1: DeepSeek API 客户端

DeepSeek API 兼容 OpenAI 格式，直接使用原生 fetch 调用，无需额外 SDK。

**文件：** `src/lib/ai/deepseek.ts`

```typescript
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

export async function deepseekGenerate(
  prompt: string,
  systemInstruction?: string,
): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY!
  const messages: { role: string; content: string }[] = []
  
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction })
  }
  messages.push({ role: 'user', content: prompt })

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DeepSeek API error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export async function deepseekJson<T>(
  prompt: string,
  systemInstruction?: string,
): Promise<T> {
  const key = process.env.DEEPSEEK_API_KEY!
  const messages: { role: string; content: string }[] = []
  
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction })
  }
  messages.push({
    role: 'user',
    content: prompt + '\n\nRespond with ONLY valid JSON, no markdown, no code fences.',
  })

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: 'json_object' },  // DeepSeek supports structured JSON
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DeepSeek API error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  return JSON.parse(text) as T
}
```

---

### Task 2.2: AI 评分 + 分类 + 摘要 Prompt

**文件：** `src/lib/ai/prompts.ts`

```typescript
export const AI_SCORE_SYSTEM = `你是一个 AI 行业分析助手。你的任务是评估一条内容对中文 AI 从业者的价值。

评分标准（0-100）：
- 90-100: 重大模型发布、突破性论文、行业地震级事件
- 75-89: 重要产品更新、知名人物观点、有价值的技术分享
- 60-74: 一般行业动态、常规产品更新
- 40-59: 相关性较弱、营销内容
- 0-39: 与 AI 无关

分类：
- "ai-models": 模型发布/更新（新模型、微调、量化、基准测试）
- "ai-products": 产品发布/更新（API、工具、平台、应用）
- "industry": 行业动态（融资、政策、人事、合作、事件）
- "paper": 论文/研究（新论文、技术报告、研究突破）
- "tip": 技巧/观点（教程、经验分享、观点文章、Prompt工程）

标签: 从以下列表中选择 1-4 个最相关的：
["大模型","多模态","推理","开源","智能体","编码","搜索","语音","图像生成","视频生成","安全","对齐","部署","评测","RAG","微调","产品","融资","开源","教程","Prompt","Anthropic","OpenAI","Google","Meta","DeepSeek","Qwen","其他"]

"精选"判断标准（aiSelected=true 的条件）：
- 评分 >= 75
- 对中文 AI 从业者有直接参考价值
- 不是纯营销/软文

对每条内容，输出以下 JSON：`

export const AI_SCORE_USER = (item: {
  title?: string | null
  content?: string | null
  sourceName: string
}): string => `
标题：${item.title ?? '(无)'}
来源：${item.sourceName}
内容：${(item.content ?? '(无)').slice(0, 2000)}

请输出 JSON：
{
  "relevance": number (0-100),
  "category": "ai-models" | "ai-products" | "industry" | "paper" | "tip",
  "tags": string[],
  "selected": boolean,
  "titleZh": "中文标题（≤30字）",
  "summaryZh": "中文摘要（≤150字，抓住核心信息）",
  "curatorNote": "推荐理由（≤50字，解释为什么值得关注，如果selected=false则留空）"
}`

export const DAILY_SECTIONS = [
  { label: '模型发布/更新', key: 'ai-models' as const },
  { label: '产品发布/更新', key: 'ai-products' as const },
  { label: '行业动态', key: 'industry' as const },
  { label: '论文研究', key: 'paper' as const },
  { label: '技巧与观点', key: 'tip' as const },
]

export const DAILY_REPORT_SYSTEM = `你是 AI HOT 的主编。根据今天的精选 AI 内容，生成一份日报。

格式要求：
- 导语用 2-3 句话概括今天最重要的动态
- 每个版块列出该分类下最重要的条目
- 每条目包含：标题（中文）、一句话摘要、原文链接

用中文输出。`

export const DAILY_REPORT_USER = (date: string, sections: {
  label: string
  items: { titleZh?: string | null; summaryZh?: string | null; url: string; curatorNote?: string | null }[]
}[]): string => `
日期：${date}

以下是今天的精选内容，按分类整理：

${sections.map((s) => `
## ${s.label}
${s.items.map((i, idx) => `${idx + 1}. ${i.titleZh ?? '(无标题)'}
   摘要：${i.summaryZh ?? '(无)'}
   链接：${i.url}
   推荐语：${i.curatorNote ?? '(无)'}`).join('\n')}`).join('\n')}

请生成日报（JSON格式）：
{
  "leadTitle": "导语标题（≤30字）",
  "leadSummary": "导语正文（2-3句话，概括今日最重要的动态）",
  "sections": [
    {
      "label": "版块名",
      "items": ["item_id1", "item_id2"]  // 保留的条目 IDs，按重要性排序
    }
  ]
}
保留最有价值的条目，每个版块 3-8 条为宜。`
```

---

### Task 2.3: AI 处理管线 — 批量评分

**文件：** `src/lib/ai/pipeline.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { deepseekJson } from './deepseek'
import { AI_SCORE_SYSTEM, AI_SCORE_USER } from './prompts'

interface AiScoreResult {
  relevance: number
  category: string
  tags: string[]
  selected: boolean
  titleZh: string
  summaryZh: string
  curatorNote: string
}

export async function processUnscoredItems(batchSize = 10): Promise<{
  processed: number
  selected: number
  errors: string[]
}> {
  const errors: string[] = []
  let processed = 0
  let selected = 0

  // 找到未评分的条目
  const items = await prisma.item.findMany({
    where: {
      aiRelevance: null,
      duplicateOfId: null,
    },
    include: { source: true },
    take: batchSize,
    orderBy: { publishedAt: 'desc' },
  })

  if (items.length === 0) return { processed: 0, selected: 0, errors: [] }

  // 逐条处理（DeepSeek 支持较高并发，但为避免限流串行处理）
  for (const item of items) {
    try {
      const result = await deepseekJson<AiScoreResult>(
        AI_SCORE_USER({
          title: item.title,
          content: item.content,
          sourceName: item.source.name,
        }),
        AI_SCORE_SYSTEM,
      )

      await prisma.item.update({
        where: { id: item.id },
        data: {
          aiRelevance: result.relevance,
          aiCategory: result.category,
          aiTags: result.tags,
          aiSelected: result.selected && result.relevance >= 75,
          titleZh: result.titleZh,
          summaryZh: result.summaryZh,
          curatorNote: result.curatorNote || null,
        },
      })

      processed++
      if (result.selected && result.relevance >= 75) selected++
      
      // DeepSeek API 限流宽松，但仍建议间隔 500ms 避免突发
      await new Promise((r) => setTimeout(r, 500))
    } catch (e) {
      errors.push(`Item ${item.id}: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  return { processed, selected, errors }
}
```

---

### Task 2.4: AI 日报生成

**文件：** `src/lib/ai/daily-generator.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { deepseekJson } from './deepseek'
import { DAILY_REPORT_SYSTEM, DAILY_REPORT_USER, DAILY_SECTIONS } from './prompts'

export async function generateDailyReport(date?: Date) {
  const reportDate = date ?? new Date()
  reportDate.setUTCHours(0, 0, 0, 0)
  
  const endDate = new Date(reportDate)
  endDate.setUTCHours(23, 59, 59, 999)

  // 获取当天的精选条目
  const items = await prisma.item.findMany({
    where: {
      aiSelected: true,
      publishedAt: { gte: reportDate, lte: endDate },
    },
    orderBy: { hotScore: 'desc' },
  })

  if (items.length === 0) return null

  // 按分类分组
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
  })).filter((s) => s.items.length > 0)

  const result = await deepseekJson<{
    leadTitle: string
    leadSummary: string
    sections: { label: string; items: string[] }[]
  }>(
    DAILY_REPORT_USER(reportDate.toISOString().split('T')[0], sections),
    DAILY_REPORT_SYSTEM,
  )

  // 存入数据库
  const daily = await prisma.daily.create({
    data: {
      date: reportDate,
      lead: { title: result.leadTitle, summary: result.leadSummary },
      sections: result.sections,
      itemCount: items.length,
    },
  })

  return daily
}
```

---

### Task 2.5: AI 处理 Cron 端点 + GitHub Actions

**文件：** `src/app/api/cron/ai-process/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { processUnscoredItems } from '@/lib/ai/pipeline'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await processUnscoredItems(10)
  return NextResponse.json({ success: true, ...result })
}
```

**GitHub Actions 定时触发 AI 处理：** `.github/workflows/ai-process.yml`

```yaml
name: AI Process Cron

on:
  schedule:
    - cron: '*/10 * * * *'  # 每 10 分钟

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger AI processing
        run: |
          curl -s -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "https://YOUR_DOMAIN.vercel.app/api/cron/ai-process"
```

> **为什么用 GitHub Actions？** Vercel Hobby 只有 1 个 cron job，已经给采集了。GitHub Actions 免费（公开仓库无限），用来触发 AI 处理和日报生成。

---

## Phase 3: 前端展示

### Task 3.1: 首页 — 精选信息流

**文件：** `src/app/page.tsx`

```tsx
import { prisma } from '@/lib/prisma'
import { ItemCard } from '@/components/item-card'
import { CategoryFilter } from '@/components/category-filter'
import { SearchBar } from '@/components/search-bar'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // ISR 5min

const CATEGORIES = [
  { slug: null, label: '全部' },
  { slug: 'ai-models', label: '模型' },
  { slug: 'ai-products', label: '产品' },
  { slug: 'industry', label: '行业' },
  { slug: 'paper', label: '论文' },
  { slug: 'tip', label: '技巧' },
]

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  const params = await searchParams
  const category = params.category ?? undefined
  const q = params.q ?? undefined

  const where: Record<string, unknown> = {
    aiSelected: true,
  }
  if (category) where.aiCategory = category
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { titleZh: { contains: q, mode: 'insensitive' } },
      { summaryZh: { contains: q, mode: 'insensitive' } },
    ]
  }

  const items = await prisma.item.findMany({
    where: where as any,
    include: { source: { select: { name: true, slug: true } } },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  })

  // 按日期分组
  const grouped = groupByDate(items)

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">精选</h1>
        <p className="text-sm text-muted-foreground">AI 自动挑选的高价值内容</p>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <CategoryFilter categories={CATEGORIES} active={category} />
      </div>
      <div className="mb-6">
        <SearchBar defaultValue={q} />
      </div>

      {Object.entries(grouped).map(([date, dateItems]) => (
        <section key={date} className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 sticky top-0 bg-background py-1 z-10">
            {date}
          </h2>
          <div className="space-y-3">
            {dateItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}

      {items.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          暂无内容
        </p>
      )}
    </main>
  )
}

function groupByDate(items: any[]) {
  const map: Record<string, any[]> = {}
  for (const item of items) {
    const date = new Date(item.publishedAt).toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
    })
    if (!map[date]) map[date] = []
    map[date].push(item)
  }
  return map
}
```

---

### Task 3.2: ItemCard 组件

**文件：** `src/components/item-card.tsx`

```tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface ItemCardProps {
  item: {
    id: string
    title?: string | null
    titleZh?: string | null
    summaryZh?: string | null
    curatorNote?: string | null
    url: string
    publishedAt: Date
    hotScore: number
    aiCategory?: string | null
    aiTags: string[]
    source: { name: string }
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  'ai-models': '模型发布',
  'ai-products': '产品更新',
  industry: '行业动态',
  paper: '论文研究',
  tip: '技巧观点',
}

export function ItemCard({ item }: ItemCardProps) {
  const time = new Date(item.publishedAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Card className="p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* 头部：信源 + 时间 */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-medium">{item.source.name}</span>
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>

          {/* 标题 */}
          <Link
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] leading-relaxed hover:text-primary transition-colors line-clamp-4"
          >
            {item.titleZh ?? item.title ?? '(无标题)'}
          </Link>

          {/* 标签 */}
          {item.aiTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.aiTags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {item.aiCategory && (
                <Badge variant="outline" className="text-xs">
                  {CATEGORY_LABELS[item.aiCategory] ?? item.aiCategory}
                </Badge>
              )}
            </div>
          )}

          {/* 推荐理由 */}
          {item.curatorNote && (
            <>
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                💡 {item.curatorNote}
              </p>
            </>
          )}
        </div>

        {/* 热度 */}
        <div className="text-xs font-mono text-muted-foreground shrink-0 pt-0.5">
          {item.hotScore > 0 && (
            <span className="tabular-nums">{item.hotScore}</span>
          )}
        </div>
      </div>
    </Card>
  )
}
```

---

### Task 3.3: 分类筛选 + 搜索组件

**文件：** `src/components/category-filter.tsx`

```tsx
'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Category {
  slug: string | null
  label: string
}

export function CategoryFilter({
  categories,
  active,
}: {
  categories: Category[]
  active?: string
}) {
  const searchParams = useSearchParams()
  const q = searchParams.get('q')

  return (
    <>
      {categories.map((cat) => {
        const href = cat.slug
          ? `/?category=${cat.slug}${q ? `&q=${q}` : ''}`
          : `/${q ? `?q=${q}` : ''}`
        const isActive = (cat.slug ?? null) === (active ?? null)
        return (
          <Button
            key={cat.slug ?? 'all'}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            asChild
          >
            <Link href={href}>{cat.label}</Link>
          </Button>
        )
      })}
    </>
  )
}
```

**文件：** `src/components/search-bar.tsx`

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'

export function SearchBar({ defaultValue }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? '')
  const router = useRouter()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) {
          router.push(`/?q=${encodeURIComponent(value.trim())}`)
        } else {
          router.push('/')
        }
      }}
      className="flex gap-2"
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜索标题/摘要…"
        className="flex-1"
      />
      <Button type="submit" size="icon" variant="outline">
        <Search className="h-4 w-4" />
      </Button>
    </form>
  )
}
```

---

### Task 3.4: 「全部 AI 动态」页面

**文件：** `src/app/all/page.tsx`

```tsx
import { prisma } from '@/lib/prisma'
import { ItemCard } from '@/components/item-card'
import { CategoryFilter } from '@/components/category-filter'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  { slug: null, label: '全部' },
  { slug: 'ai-models', label: '模型' },
  { slug: 'ai-products', label: '产品' },
  { slug: 'industry', label: '行业' },
  { slug: 'paper', label: '论文' },
  { slug: 'tip', label: '技巧' },
]

export default async function AllPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>
}) {
  const params = await searchParams
  const category = params.category
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const pageSize = 30

  const where: Record<string, unknown> = {
    aiRelevance: { gte: 60 },
    duplicateOfId: null,
  }
  if (category) where.aiCategory = category

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where: where as any,
      include: { source: { select: { name: true } } },
      orderBy: { publishedAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.item.count({ where: where as any }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">全部 AI 动态</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        <CategoryFilter categories={CATEGORIES} active={category} />
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <ItemCard key={item.id} item={item as any} />
        ))}
      </div>

      {/* 分页 */}
      <div className="flex justify-center gap-2 mt-6">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <a
            key={p}
            href={`/all?${category ? `category=${category}&` : ''}page=${p}`}
            className={`px-3 py-1 rounded text-sm ${
              p === page
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            {p}
          </a>
        ))}
      </div>
    </main>
  )
}
```

---

### Task 3.5: AI 日报页面

**文件：** `src/app/daily/page.tsx`

```tsx
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export default async function DailyPage() {
  const latestDaily = await prisma.daily.findFirst({
    orderBy: { date: 'desc' },
  })

  if (!latestDaily) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-4">AI 日报</h1>
        <p className="text-muted-foreground">暂无日报</p>
      </main>
    )
  }

  const sections = latestDaily.sections as {
    label: string
    items: string[]
  }[]
  const lead = latestDaily.lead as { title: string; summary: string }

  // 批量获取日报中引用的条目
  const allItemIds = sections.flatMap((s) => s.items)
  const items = await prisma.item.findMany({
    where: { id: { in: allItemIds } },
    include: { source: { select: { name: true } } },
  })
  const itemMap = new Map(items.map((i) => [i.id, i]))

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-2">AI 日报</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {new Date(latestDaily.date).toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </p>

      {/* 导语 */}
      <Card className="p-4 mb-6 bg-primary/5 border-primary/20">
        <h2 className="font-semibold mb-1">{lead.title}</h2>
        <p className="text-sm text-muted-foreground">{lead.summary}</p>
      </Card>

      {/* 版块 */}
      {sections.map((section) => (
        <section key={section.label} className="mb-6">
          <h2 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
            {section.label}
          </h2>
          <div className="space-y-2">
            {section.items.map((itemId) => {
              const item = itemMap.get(itemId)
              if (!item) return null
              return (
                <Link
                  key={itemId}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="text-sm font-medium">
                    {item.titleZh ?? item.title}
                  </div>
                  {item.summaryZh && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.summaryZh}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {item.source.name}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
```

### Task 3.6: 日报归档页面

**文件：** `src/app/daily/[date]/page.tsx`

```tsx
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function DailyDatePage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const dateObj = new Date(date)
  if (isNaN(dateObj.getTime())) notFound()

  const daily = await prisma.daily.findFirst({
    where: {
      date: {
        gte: new Date(dateObj.setUTCHours(0, 0, 0, 0)),
        lte: new Date(dateObj.setUTCHours(23, 59, 59, 999)),
      },
    },
  })

  if (!daily) notFound()

  // ... 同日报页面渲染逻辑
  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/daily" className="text-sm text-muted-foreground hover:text-primary mb-4 block">
        ← 返回日报列表
      </Link>
      {/* 同 daily/page.tsx 的渲染 */}
    </main>
  )
}
```

---

## Phase 4: RSS + API

### Task 4.1: RSS 输出

**文件：** `src/app/feed.xml/route.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { Feed } from 'feed'

export async function GET() {
  const items = await prisma.item.findMany({
    where: { aiSelected: true },
    include: { source: { select: { name: true } } },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  })

  const feed = new Feed({
    title: 'AI HOT — 精选',
    description: 'AI HOT 每日精选 AI 行业动态',
    id: 'https://YOUR_DOMAIN.vercel.app/',
    link: 'https://YOUR_DOMAIN.vercel.app/',
    language: 'zh-CN',
    copyright: '',
    updated: items[0]?.publishedAt ?? new Date(),
    generator: 'AI HOT',
    feedLinks: {
      rss: 'https://YOUR_DOMAIN.vercel.app/feed.xml',
    },
  })

  for (const item of items) {
    feed.addItem({
      title: item.titleZh ?? item.title ?? '',
      id: item.id,
      link: item.url,
      description: item.summaryZh ?? item.content ?? '',
      date: item.publishedAt,
      author: [{ name: item.source.name }],
    })
  }

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
```

同样创建 `src/app/feed/all.xml/route.ts`（全部）和 `src/app/feed/daily.xml/route.ts`（最新日报）。

---

### Task 4.2: 公开 REST API

**文件：** `src/app/api/public/items/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') ?? 'selected'
  const category = searchParams.get('category')
  const since = searchParams.get('since')
  const q = searchParams.get('q')
  const take = Math.min(parseInt(searchParams.get('take') ?? '50', 10), 100)
  const cursor = searchParams.get('cursor')

  const where: Record<string, unknown> = {
    duplicateOfId: null,
  }

  // mode 过滤
  if (mode === 'selected') {
    where.aiSelected = true
  } else {
    // mode=all: 过滤低相关度
    where.aiRelevance = { gte: 60 }
  }

  if (category) where.aiCategory = category

  if (since) {
    const sinceDate = new Date(since)
    if (!isNaN(sinceDate.getTime())) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      where.publishedAt = {
        gte: sinceDate > sevenDaysAgo ? sinceDate : sevenDaysAgo,
      }
    }
  }

  if (q && q.length >= 2) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { titleZh: { contains: q, mode: 'insensitive' } },
      { summaryZh: { contains: q, mode: 'insensitive' } },
    ]
  }

  // cursor 分页
  const cursorWhere = cursor
    ? { id: { lt: cursor }, ...where }
    : where

  const items = await prisma.item.findMany({
    where: cursorWhere as any,
    include: { source: { select: { name: true, slug: true } } },
    orderBy: { publishedAt: 'desc' },
    take: take + 1,
  })

  const hasMore = items.length > take
  const resultItems = hasMore ? items.slice(0, take) : items
  const nextCursor = hasMore ? resultItems[resultItems.length - 1].id : null

  return NextResponse.json({
    items: resultItems,
    nextCursor,
    hasMore,
  })
}
```

**文件：** `src/app/api/public/daily/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const daily = await prisma.daily.findFirst({
    orderBy: { date: 'desc' },
  })

  if (!daily) {
    return NextResponse.json({ error: 'no daily yet' }, { status: 404 })
  }

  return NextResponse.json(daily)
}
```

---

## Phase 5: 主题 + 导航 + 部署

### Task 5.1: 主题切换 (深色/浅色/跟随系统)

**文件：** `src/components/theme-provider.tsx`

```tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
```

在 `src/app/layout.tsx` 中使用：

```tsx
import { ThemeProvider } from '@/components/theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

---

### Task 5.2: 导航栏

**文件：** `src/components/navbar.tsx`

```tsx
import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'

const NAV_ITEMS = [
  { href: '/', label: '精选' },
  { href: '/all', label: '全部 AI 动态' },
  { href: '/daily', label: 'AI 日报' },
]

export function Navbar() {
  return (
    <header className="border-b sticky top-0 bg-background/80 backdrop-blur z-50">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Link href="/" className="font-bold text-lg mr-4">
            AI<span className="text-primary">HOT</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1 text-sm rounded-md hover:bg-secondary transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
```

---

### Task 5.3: Vercel 部署

**部署步骤：**

```bash
# 1. 推送到 GitHub
git add -A
git commit -m "feat: complete AIHOT clone"
git push origin main

# 2. 在 Vercel 中导入项目
# - 连接 GitHub 仓库
# - 设置环境变量 (DATABASE_URL, DEEPSEEK_API_KEY, DEEPSEEK_MODEL, X_BEARER_TOKEN, CRON_SECRET)
# - 部署

# 3. 部署后设置 GitHub Secrets
# 在 GitHub → Settings → Secrets and variables → Actions 添加：
#   CRON_SECRET = 与 Vercel 环境变量相同
```

**Vercel 环境变量：**
```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
DEEPSEEK_API_KEY=sk-your-key
DEEPSEEK_MODEL=deepseek-v4-flash
X_BEARER_TOKEN=AAAAAAAA...
CRON_SECRET=random_string_here
```

---

## Phase 6: 高级功能（可选）

### 可选 6.1: 图片代理

**文件：** `src/app/api/img-proxy/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('u')
  if (!url) return NextResponse.json({ error: 'missing u' }, { status: 400 })

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AIHOT/1.0' },
    })
    if (!res.ok) throw new Error('fetch failed')

    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 502 })
  }
}
```

### 可选 6.2: Agent Skill 接入 (SKILL.md)

创建 `public/aihot-skill/SKILL.md` — 参照 aihot.virxact.com 的公开 Skill 格式。

---

## 完整文件清单

```
aihot/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # 精选首页
│   │   ├── all/page.tsx                # 全部动态
│   │   ├── daily/
│   │   │   ├── page.tsx                # 日报
│   │   │   └── [date]/page.tsx         # 历史日报
│   │   ├── feed.xml/route.ts           # 精选 RSS
│   │   ├── feed/
│   │   │   ├── all.xml/route.ts
│   │   │   └── daily.xml/route.ts
│   │   └── api/
│   │       ├── cron/
│   │       │   ├── collect/route.ts    # 采集 cron
│   │       │   └── ai-process/route.ts # AI 处理 cron
│   │       ├── public/
│   │       │   ├── items/route.ts      # 公开 API
│   │       │   └── daily/route.ts
│   │       └── img-proxy/route.ts
│   ├── components/
│   │   ├── item-card.tsx
│   │   ├── category-filter.tsx
│   │   ├── search-bar.tsx
│   │   ├── navbar.tsx
│   │   ├── theme-provider.tsx
│   │   └── theme-toggle.tsx
│   └── lib/
│       ├── prisma.ts
│       ├── ai/
│       │   ├── deepseek.ts
│       │   ├── prompts.ts
│       │   ├── pipeline.ts
│       │   └── daily-generator.ts
│       └── collectors/
│           ├── types.ts
│           ├── base.ts
│           ├── rss.ts
│           ├── x.ts
│           ├── hn.ts
│           ├── arxiv.ts
│           └── scheduler.ts
├── .github/workflows/
│   └── ai-process.yml                 # AI 处理 cron
├── vercel.json
├── .env.local.example
├── package.json
└── README.md
```

---

## 执行顺序 & 优先级

按这个顺序让 Claude Code 执行：

| 顺序 | 阶段 | 关键 Task | 预估时间 |
|---|---|---|---|
| 1 | 项目骨架 | Task 0: 建项目 + Prisma + Supabase | 15 min |
| 2 | 数据采集 | Task 1.1-1.6: 采集器 + API + Cron | 30 min |
| 3 | AI 处理 | Task 2.1-2.5: DeepSeek 管线 + 日报 | 25 min |
| 4 | 前端展示 | Task 3.1-3.6: 页面 + 组件 | 40 min |
| 5 | 分发 | Task 4.1-4.2: RSS + REST API | 15 min |
| 6 | 收尾 | Task 5.1-5.3: 主题 + 导航 + 部署 | 15 min |

---

## 对 Claude Code 的使用说明

```bash
# 1. 在 Claude Code 中打开此 plan.md
# 2. 让 Claude Code 从 Task 0 开始逐个执行
# 3. 每个 Task 执行完后运行 npm run build 检查编译
# 4. 每完成一个 Phase 运行一次 npm run dev 做冒烟测试
# 5. 最后部署到 Vercel
```

**给 Claude Code 的 prompt：**

> "请按照 aihot-clone-plan.md 中的 Task 顺序，从 Task 0 开始逐步实现。每个 Task 先写代码，再验证，最后 commit。使用 TDD 方式。"

---

## 关键成本控制

| 项目 | 月成本 | 备注 |
|---|---|---|
| Vercel 部署 | $0 | Hobby 计划，100GB 带宽/月 |
| Supabase | $0 | 500MB 数据库，2 个项目 |
| X API v2 | $0 | Free tier 1500 条/月，需申请 |
| GitHub Actions | $0 | 公开仓库无限 |
| 域名 | $0 | 使用 vercel.app 子域名 |
| DeepSeek API | ~¥5/月 | 每次请求约 500 token 输入 + 300 token 输出，按每天处理 200 条，月费约 ¥5 |
| **总计** | **~¥5/月** | 几乎零成本 |

> 💡 DeepSeek V4 Flash 定价极低（输入约 ¥1/百万 token，输出约 ¥2/百万 token）。每条内容处理消耗约 500-800 token，按每天新入库 200 条计算，月费约 ¥3-5。充值 ¥20 足够用好几个月。

---

## 与参考站的差异

| 特性 | aihot.virxact.com | 本方案 |
|---|---|---|
| AI 模型 | 未知（推测多模型） | DeepSeek V4 Flash (自有 key) |
| 飞书推送 | ✅ | 可后续添加（免费 webhook）|
| Agent Skill | ✅ | ✅ SKILL.md 标准 |
| 登录系统 | ✅ | ❌ MVP 不含，匿名即可 |
| 用户反馈 | ✅ | 可后续添加 |
| 更新日志 | ✅ | 手工维护 |
| 数据库 | PostgreSQL (推测) | Supabase PostgreSQL |
| 部署 | VPS 自建 | Vercel 免费 |
