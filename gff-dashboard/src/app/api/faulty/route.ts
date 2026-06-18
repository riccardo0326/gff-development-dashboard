import { NextResponse } from "next/server";
import { getFaultyDtcs, getFaultyFilterOptions } from "@/lib/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("options") === "1") {
    return NextResponse.json(getFaultyFilterOptions());
  }

  const result = getFaultyDtcs({
    search: searchParams.get("search") ?? undefined,
    da_code: searchParams.get("da_code") ?? undefined,
    issue: searchParams.get("issue") ?? undefined,
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 50),
  });

  return NextResponse.json(result);
}
