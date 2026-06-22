import { NextResponse } from "next/server";
import { exportFaultyToBuffer } from "@/lib/excel/export-workbook";
import { getFaultyDtcs } from "@/lib/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const { items } = getFaultyDtcs({
    search: searchParams.get("search") ?? undefined,
    da_code: searchParams.get("da_code") ?? undefined,
    issue: searchParams.get("issue") ?? undefined,
    page: 1,
    pageSize: 100000,
  });

  const buffer = exportFaultyToBuffer(items);
  const filename = `faulty_dtcs_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
