import { NextResponse } from "next/server";
import { getStatisticsSummary } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(getStatisticsSummary());
}
