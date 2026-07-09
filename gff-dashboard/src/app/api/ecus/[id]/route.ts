import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseProjectFilterParams } from "@/lib/project-filters";
import {
  getCategoriesForEcu,
  getDtcsForEcu,
  getEcuById,
  getEcuCompletions,
  updateEcuPriority,
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
  const projects = parseProjectFilterParams(searchParams);
  const project = searchParams.get("project") as VehicleProjectId | null;

  const completion = getEcuCompletions().find((e) => e.id === id);
  const dtcs = getDtcsForEcu(
    id,
    {
      search,
      category: category ? Number(category) : undefined,
      coverage: coverage ?? undefined,
      project: projects.length === 0 ? (project ?? undefined) : undefined,
      projects: projects.length > 0 ? projects : undefined,
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { priority?: number };

  if (
    body.priority === undefined ||
    !Number.isInteger(body.priority) ||
    body.priority < 1 ||
    body.priority > 3
  ) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }

  try {
    const ecu = updateEcuPriority(id, body.priority);
    if (!ecu) {
      return NextResponse.json({ error: "ECU not found" }, { status: 404 });
    }

    return NextResponse.json({ ecu });
  } catch {
    return NextResponse.json({ error: "Could not update priority" }, { status: 400 });
  }
}
