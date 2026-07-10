import { NextResponse } from "next/server";
import { getEcuCompletions, getEcuCount } from "@/lib/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const priority = searchParams.get("priority");
  const search = searchParams.get("search") ?? undefined;
  const hasFaulty = searchParams.get("hasFaulty") === "1";

  const ecus = getEcuCompletions({
    priority: priority ? Number(priority) : undefined,
    search,
    hasFaulty: hasFaulty || undefined,
  });

  return NextResponse.json({ items: ecus, total: getEcuCount() });
}
