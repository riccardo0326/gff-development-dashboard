import { NextResponse } from "next/server";
import { requireSession, sessionToAuditUser } from "@/lib/auth";
import { bulkUpdateDtcCoverage, searchDtcs } from "@/lib/queries";
import type { VehicleProjectId } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "50");
  const search = searchParams.get("search") ?? undefined;
  const ecuId = searchParams.get("ecuId") ?? undefined;
  const category = searchParams.get("category");
  const coverage = searchParams.get("coverage") as
    | "pending"
    | "covered"
    | undefined;
  const project = searchParams.get("project") as VehicleProjectId | undefined;

  const result = searchDtcs({
    search,
    ecuId,
    category: category ? Number(category) : undefined,
    coverage: coverage || undefined,
    project,
    page,
    pageSize,
  });

  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  const auditUser = sessionToAuditUser(session);
  const body = (await request.json()) as {
    items?: Array<{
      dtcId: number;
      project: VehicleProjectId;
      status: "pending" | "covered";
    }>;
    applyToAllMatching?: boolean;
    filters?: {
      search?: string;
      ecuId?: string;
      category?: number;
      coverage?: "pending" | "covered";
      project?: VehicleProjectId;
    };
    bulkProject?: VehicleProjectId;
    bulkStatus?: "pending" | "covered";
  };

  let items = body.items ?? [];

  if (body.applyToAllMatching && body.bulkProject && body.bulkStatus) {
    const { items: matches } = searchDtcs({
      ...body.filters,
      page: 1,
      pageSize: 10000,
    });

    items = matches
      .filter((d) => {
        const project = body.bulkProject!;
        const col =
          project === "LB74x"
            ? d.coverage_lb74x
            : project === "LB636"
              ? d.coverage_lb636
              : d.coverage_lb63x;
        const applicable =
          project === "LB74x"
            ? d.applicable_lb74x
            : project === "LB636"
              ? d.applicable_lb636
              : d.applicable_lb63x;
        return applicable && col !== body.bulkStatus;
      })
      .map((d) => ({
        dtcId: d.id,
        project: body.bulkProject!,
        status: body.bulkStatus!,
      }));
  }

  if (items.length === 0) {
    return NextResponse.json(
      { error: "No updates to apply" },
      { status: 400 },
    );
  }

  for (const item of items) {
    if (!["LB74x", "LB636", "LB63x"].includes(item.project)) {
      return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    }
    if (!["pending", "covered"].includes(item.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
  }

  const result = bulkUpdateDtcCoverage(items, auditUser, {
    source: body.applyToAllMatching ? "filter_match" : "selection",
    filters: body.filters ?? undefined,
  });

  return NextResponse.json(result);
}
