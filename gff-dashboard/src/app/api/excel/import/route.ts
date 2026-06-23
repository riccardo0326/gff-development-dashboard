import { NextResponse } from "next/server";
import { getSession, sessionToAuditUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { importWorkbookFromBuffer } from "@/lib/excel/import-workbook";
import { canImportWorkbook } from "@/lib/roles";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canImportWorkbook(session.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const auditUser = sessionToAuditUser(session);

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xlsm")) {
    return NextResponse.json(
      { error: "Only .xlsx and .xlsm files are supported" },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const summary = importWorkbookFromBuffer(buffer);

    logAuditEvent({
      eventType: "import",
      summary: `Workbook imported: ${summary.ecus} ECUs, ${summary.dtcs} DTCs`,
      user: auditUser,
      details: { filename: file.name, ...summary },
    });

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
