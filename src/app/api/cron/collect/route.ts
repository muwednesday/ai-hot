import { NextRequest } from "next/server";
import { runAllCollectorsStreaming } from "@/lib/collectors/scheduler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      send({ type: "start", message: "采集开始...", timestamp: new Date().toISOString() });

      const result = await runAllCollectorsStreaming((progress) => {
        send({ type: "progress", ...progress });
      });

      send({ type: "done", ...result, timestamp: new Date().toISOString() });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
