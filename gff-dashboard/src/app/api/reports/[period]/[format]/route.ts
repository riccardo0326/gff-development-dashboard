import { NextResponse } from "next/server";
import { requireSession, sessionToAuditUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import {
  buildPeriodReportData,
  buildPeriodReportPdf,
  buildPeriodReportXlsx,
  type ReportPeriod,
} from "@/lib/reports/period-report";

function parsePeriod(value: string): ReportPeriod | null {
  if (value === "weekly" || value === "monthly") return value;
  return null;
}

async function buildReportResponse(period: ReportPeriod, formatParam: string) {
  const data = buildPeriodReportData(period);
  const label = period === "weekly" ? "weekly" : "monthly";
  const dateStamp = data.dateTo;

  if (formatParam === "xlsx") {
    const buffer = buildPeriodReportXlsx(data);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="GFF_${label}_report_${dateStamp}.xlsx"`,
      },
    });
  }

  if (formatParam === "pdf") {
    const buffer = await buildPeriodReportPdf(data);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="GFF_${label}_report_${dateStamp}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid format" }, { status: 400 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ period: string; format: string }> },
) {
  await requireSession();
  const { period: periodParam, format: formatParam } = await context.params;
  const period = parsePeriod(periodParam);

  if (!period) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  try {
    return await buildReportResponse(period, formatParam);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ period: string; format: string }> },
) {
  const session = await requireSession();
  const auditUser = sessionToAuditUser(session);
  const { period: periodParam, format: formatParam } = await context.params;
  const period = parsePeriod(periodParam);

  if (!period) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  logAuditEvent({
    eventType: "report",
    summary: `${period === "weekly" ? "Weekly" : "Monthly"} report downloaded (${formatParam})`,
    user: auditUser,
    details: { period, format: formatParam },
  });

  return buildReportResponse(period, formatParam);
}
