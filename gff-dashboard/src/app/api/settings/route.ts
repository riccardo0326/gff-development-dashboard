import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { canEditForecastParameters } from "@/lib/roles";
import { getSettings, updateSettings } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PUT(request: Request) {
  const session = await requireSession();
  if (!canEditForecastParameters(session.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<{
    daily_estimate: number;
    forecast_start_date: string;
    baseline_implemented: number;
    statistics_chart_year: number;
  }>;

  const settings = updateSettings(body);
  return NextResponse.json(settings);
}
