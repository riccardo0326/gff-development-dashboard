import { NextResponse } from "next/server";
import { getEcuCompletions } from "@/lib/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const priority = searchParams.get("priority");
  const search = searchParams.get("search") ?? undefined;

  const ecus = getEcuCompletions({
    priority: priority ? Number(priority) : undefined,
    search,
  });

  return NextResponse.json(ecus);
}
