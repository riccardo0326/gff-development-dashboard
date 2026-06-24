import { NextResponse } from "next/server";
import { getActivityLog } from "@/lib/audit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "50");
  const eventType = searchParams.get("eventType") ?? undefined;
  const role = searchParams.get("role") ?? undefined;
  const fromDate = searchParams.get("fromDate") ?? undefined;
  const toDate = searchParams.get("toDate") ?? undefined;

  const result = getActivityLog({
    page,
    pageSize,
    eventType,
    role,
    fromDate,
    toDate,
  });
  return NextResponse.json(result);
}
