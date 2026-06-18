import { NextResponse } from "next/server";
import {
  getCategoriesForEcu,
  getDtcsForEcu,
  getEcuById,
  getEcuCompletions,
} from "@/lib/queries";
import type { VehicleProjectId } from "@/lib/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const ecu = getEcuById(id);
  if (!ecu) {
    return NextResponse.json({ error: "ECU not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 100);
  const search = searchParams.get("search") ?? undefined;
  const category = searchParams.get("category");
  const coverage = searchParams.get("coverage") as
    | "pending"
    | "covered"
    | null;
  const project = searchParams.get("project") as VehicleProjectId | null;

  const completion = getEcuCompletions().find((e) => e.id === id);
  const dtcs = getDtcsForEcu(
    id,
    {
      search,
      category: category ? Number(category) : undefined,
      coverage: coverage ?? undefined,
      project: project ?? undefined,
    },
    { page, pageSize },
  );
  const categories = getCategoriesForEcu(id);

  return NextResponse.json({
    ecu,
    completion: completion?.projects ?? null,
    categories,
    ...dtcs,
    page,
    pageSize,
  });
}
