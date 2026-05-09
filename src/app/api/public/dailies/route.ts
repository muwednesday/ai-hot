import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const take = Math.min(parseInt(searchParams.get("take") ?? "30", 10), 100);

  const dailies = await prisma.daily.findMany({
    orderBy: { date: "desc" },
    take,
    select: {
      id: true,
      date: true,
      lead: true,
      itemCount: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ dailies });
}
