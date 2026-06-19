import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Partial<{
    daily_estimate: number;
    forecast_start_date: string;
    baseline_implemented: number;
  }>;

  const settings = updateSettings(body);
  return NextResponse.json(settings);
}
