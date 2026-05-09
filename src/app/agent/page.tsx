import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";

export default function AgentPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 flex-1">
        <h1 className="text-xl font-bold mb-2">API &amp; Agent 接入</h1>
        <p className="text-sm text-muted-foreground mb-6">
          AI HOT 提供多种方式接入数据
        </p>

        <div className="space-y-6">
          <section>
            <h2 className="text-base font-semibold mb-3">REST API</h2>
            <Card className="p-4">
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium mb-1">获取精选条目</p>
                  <code className="text-xs bg-secondary px-2 py-1 rounded block overflow-x-auto">
                    GET /api/public/items?mode=selected&amp;category=ai-models&amp;take=20
                  </code>
                </div>
                <div>
                  <p className="font-medium mb-1">获取全部条目</p>
                  <code className="text-xs bg-secondary px-2 py-1 rounded block overflow-x-auto">
                    GET /api/public/items?mode=all&amp;cursor=xxx
                  </code>
                </div>
                <div>
                  <p className="font-medium mb-1">获取最新日报</p>
                  <code className="text-xs bg-secondary px-2 py-1 rounded block overflow-x-auto">
                    GET /api/public/daily
                  </code>
                </div>
                <div className="text-xs text-muted-foreground">
                  参数: mode (selected|all), category, since (ISO date), q
                  (搜索), take (1-100), cursor (分页)
                </div>
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">RSS 订阅</h2>
            <Card className="p-4">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">精选: </span>
                  <a
                    href="/feed.xml"
                    className="text-primary hover:underline text-xs"
                  >
                    /feed.xml
                  </a>
                </div>
                <div>
                  <span className="font-medium">全部: </span>
                  <a
                    href="/feed/all.xml"
                    className="text-primary hover:underline text-xs"
                  >
                    /feed/all.xml
                  </a>
                </div>
                <div>
                  <span className="font-medium">日报: </span>
                  <a
                    href="/feed/daily.xml"
                    className="text-primary hover:underline text-xs"
                  >
                    /feed/daily.xml
                  </a>
                </div>
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">Claude Code / Agent</h2>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                在 Claude Code 中，你可以直接请求 AI HOT 的数据：
              </p>
              <pre className="mt-2 text-xs bg-secondary p-3 rounded overflow-x-auto">
                {`帮我看看今天有什么 AI 重要的新闻
参考这个 API: GET ${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/public/items?mode=selected&take=10`}
              </pre>
            </Card>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
