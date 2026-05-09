import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const daily = await prisma.daily.findFirst({
    orderBy: { date: "desc" },
  });

  if (!daily) {
    return NextResponse.json({ error: "no daily yet" }, { status: 404 });
  }

  return NextResponse.json(daily);
}
