import { NextResponse } from "next/server";
import { importWorkbookFromBuffer } from "@/lib/excel/import-workbook";

export async function POST(request: Request) {
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
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
