import { NextResponse } from "next/server";
import { requireSession, sessionToAuditUser } from "@/lib/auth";
import { updateDtcCoverage, updateDtcDetails } from "@/lib/queries";
import type { VehicleProjectId } from "@/lib/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; dtcId: string }> },
) {
  const session = await requireSession();
  const auditUser = sessionToAuditUser(session);
  const { dtcId } = await context.params;
  const body = (await request.json()) as {
    project?: VehicleProjectId;
    status?: "pending" | "covered" | null;
    gff_available?: boolean;
    gff_program?: string | null;
    error_handling?: string | null;
    error_setting_conditions?: string | null;
    coverageUpdates?: Array<{
      project: VehicleProjectId;
      status: "pending" | "covered";
    }>;
  };

  const numericId = Number(dtcId);

  if (body.project !== undefined) {
    if (!body.project || !["LB74x", "LB636", "LB63x"].includes(body.project)) {
      return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    }

    if (
      body.status !== null &&
      body.status !== undefined &&
      !["pending", "covered"].includes(body.status)
    ) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const result = updateDtcCoverage(
      numericId,
      body.project,
      body.status ?? null,
      auditUser,
    );
    if (!result) {
      return NextResponse.json({ error: "DTC not found" }, { status: 404 });
    }

    return NextResponse.json({
      dtc: result.dtc,
      dailyUpdate: result.dailyStat,
    });
  }

  const result = updateDtcDetails(numericId, body, auditUser);
  if (!result) {
    return NextResponse.json({ error: "DTC not found" }, { status: 404 });
  }

  return NextResponse.json({
    dtc: result.dtc,
    dailyUpdate: result.dailyStat,
  });
}
