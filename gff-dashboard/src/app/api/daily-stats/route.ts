import { NextResponse } from "next/server";
import { addDailyStat, getDailyStats } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(getDailyStats());
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    stat_date: string;
    impl_for_day: number;
  };

  if (!body.stat_date || !Number.isFinite(body.impl_for_day)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const row = addDailyStat(body);
  return NextResponse.json(row, { status: 201 });
}
