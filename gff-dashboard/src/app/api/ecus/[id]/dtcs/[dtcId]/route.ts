import { NextResponse } from "next/server";
import { updateDtcCoverage } from "@/lib/queries";
import type { VehicleProjectId } from "@/lib/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; dtcId: string }> },
) {
  const { dtcId } = await context.params;
  const body = (await request.json()) as {
    project: VehicleProjectId;
    status: "pending" | "covered" | null;
  };

  if (!body.project || !["LB74x", "LB636", "LB63x"].includes(body.project)) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  if (body.status !== null && !["pending", "covered"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const result = updateDtcCoverage(Number(dtcId), body.project, body.status);
  if (!result) {
    return NextResponse.json({ error: "DTC not found" }, { status: 404 });
  }

  return NextResponse.json({
    dtc: result.dtc,
    dailyUpdate: result.dailyStat,
  });
}
