import { NextResponse } from "next/server";
import { getSession, sessionToAuditUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { filenameDateStamp } from "@/lib/datetime";
import { exportWorkbookToBuffer } from "@/lib/excel/export-workbook";
import { canExportWorkbook } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canExportWorkbook(session.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const auditUser = sessionToAuditUser(session);

  try {
    const buffer = exportWorkbookToBuffer();
    const filename = `GFF_development_export_${filenameDateStamp()}.xlsm`;

    logAuditEvent({
      eventType: "export",
      summary: "Workbook exported",
      user: auditUser,
      details: { filename },
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.ms-excel.sheet.macroEnabled.12",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
