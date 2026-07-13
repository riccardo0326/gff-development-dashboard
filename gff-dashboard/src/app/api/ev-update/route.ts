import { NextResponse } from "next/server";
import { getSession, sessionToAuditUser } from "@/lib/auth";
import { runEvUpdate } from "@/lib/odx";
import { canEvUpdate } from "@/lib/roles";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = [".odx", ".xml", ".pdx", ".zip"];

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canEvUpdate(session.user?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "true";

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const lower = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return NextResponse.json(
      { error: "Supported formats: .odx, .xml, .pdx, .zip" },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 200 MB limit" },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const auditUser = sessionToAuditUser(session);
    const result = await runEvUpdate(buffer, file.name, auditUser, { dryRun });

    return NextResponse.json({
      ok: true,
      applied: result.applied,
      dryRun,
      diff: result.diff,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "EV Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
