import { NextRequest, NextResponse } from "next/server";
import { processUnscoredItems } from "@/lib/ai/pipeline";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processUnscoredItems(10);
  return NextResponse.json({ success: true, ...result });
}
