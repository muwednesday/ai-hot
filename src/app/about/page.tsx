import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const DATA_SOURCES = [
  { name: "Hacker News", type: "API", desc: "科技热门 AI 相关帖子" },
  { name: "arXiv", type: "API", desc: "cs.AI / cs.CL / cs.LG 最新论文" },
  { name: "IT之家", type: "RSS", desc: "中文科技新闻" },
  { name: "机器之心", type: "RSS", desc: "AI 专业媒体" },
  { name: "量子位", type: "RSS", desc: "AI 前沿资讯" },
  { name: "Hugging Face Blog", type: "RSS", desc: "开源 AI 生态" },
  { name: "GitHub Blog", type: "RSS", desc: "开发者平台动态" },
  { name: "BAIR Blog", type: "RSS", desc: "伯克利 AI 研究" },
  { name: "X / Twitter", type: "RSSHub", desc: "AI 领域关键人物推文" },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 flex-1 w-full">
        <h1 className="text-xl font-bold mb-2">关于 AI HOT</h1>
        <p className="text-sm text-muted-foreground mb-8">
          AI 驱动的中文 AI 行业资讯聚合站
        </p>

        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3">这是什么？</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            AI HOT 自动采集全球各大平台的 AI 行业动态，使用 DeepSeek 大模型进行智能评分、分类、翻译和摘要，为你筛选出每天最值得关注的 AI 资讯。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3">数据来源</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DATA_SOURCES.map((source) => (
              <div
                key={source.name}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-card border border-border/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{source.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{source.desc}</div>
                </div>
                <span className="text-[10px] font-medium text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                  {source.type}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">开放接口</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            所有精选内容均通过公开 API 和 RSS 输出，供开发者和 AI 代理接入使用。
          </p>
          <p className="text-sm mt-2">
            <a href="/agent" className="text-primary hover:underline">API 文档</a>
            <span className="text-muted-foreground mx-2">·</span>
            <a href="/feed.xml" className="text-primary hover:underline">RSS 订阅</a>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
