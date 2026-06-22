import { NextResponse } from "next/server";
import { requireSession, sessionToAuditUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { exportWorkbookToBuffer } from "@/lib/excel/export-workbook";

export async function GET() {
  const session = await requireSession();
  const auditUser = sessionToAuditUser(session);

  try {
    const buffer = exportWorkbookToBuffer();
    const filename = `GFF_development_export_${new Date().toISOString().slice(0, 10)}.xlsm`;

    logAuditEvent({
      eventType: "export",
      summary: "Workbook exported",
      user: auditUser,
      details: { filename },
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.ms-excel.sheet.macroEnabled.12",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
