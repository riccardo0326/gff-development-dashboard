import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { format, subDays } from "date-fns";
import { getDb } from "@/lib/db";
import {
  getAllCoverageRows,
  getDailyStats,
  getEcus,
  getFaultyDtcIds,
  getSettings,
} from "@/lib/queries";
import { buildPriorityStats } from "@/lib/calculations";
import { formatNumber, formatPercent } from "@/lib/utils";

export type ReportPeriod = "weekly" | "monthly";

function periodDays(period: ReportPeriod): number {
  return period === "weekly" ? 7 : 30;
}

function periodLabel(period: ReportPeriod): string {
  return period === "weekly" ? "Weekly" : "Monthly";
}

export interface PeriodReportData {
  period: ReportPeriod;
  days: number;
  generatedAt: string;
  dateFrom: string;
  dateTo: string;
  settings: ReturnType<typeof getSettings>;
  priorityStats: ReturnType<typeof buildPriorityStats>;
  dailyStats: ReturnType<typeof getDailyStats>;
  periodDailyStats: Array<{
    stat_date: string;
    impl_for_day: number;
    impl_for_day_auto: number;
    impl_for_day_manual: number;
    implemented_count: number;
  }>;
  coverageChanges: Array<{
    changed_at: string;
    ecu_code: string;
    trouble_code: string | null;
    symptom: string | null;
    project: string;
    from_status: string;
    to_status: string;
    username: string | null;
    change_source: string;
  }>;
  totals: {
    changesInPeriod: number;
    coveredInPeriod: number;
    revertedInPeriod: number;
    gffsForPeriod: number;
  };
}

export function buildPeriodReportData(period: ReportPeriod): PeriodReportData {
  const days = periodDays(period);
  const dateTo = format(new Date(), "yyyy-MM-dd");
  const dateFrom = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  const db = getDb();

  const settings = getSettings();
  const ecus = getEcus();
  const rows = getAllCoverageRows();
  const dailyStats = getDailyStats();
  const priorityStats = buildPriorityStats(ecus, rows, settings, dailyStats, {
    faultyDtcIds: getFaultyDtcIds(),
  });

  const periodDailyStats = dailyStats
    .filter((d) => d.stat_date >= dateFrom && d.stat_date <= dateTo)
    .map((d) => ({
      stat_date: d.stat_date,
      impl_for_day: d.impl_for_day,
      impl_for_day_auto: d.impl_for_day_auto ?? 0,
      impl_for_day_manual: d.impl_for_day_manual ?? 0,
      implemented_count: d.implemented_count,
    }));

  const coverageChanges = db
    .prepare(
      `
      SELECT cc.changed_at, cc.project, cc.from_status, cc.to_status,
             cc.username, cc.change_source, cc.trouble_code, cc.symptom,
             e.code as ecu_code
      FROM coverage_changes cc
      JOIN ecus e ON e.id = cc.ecu_id
      WHERE cc.stat_date >= ? AND cc.stat_date <= ?
      ORDER BY cc.changed_at DESC
    `,
    )
    .all(dateFrom, dateTo) as PeriodReportData["coverageChanges"];

  let coveredInPeriod = 0;
  let revertedInPeriod = 0;
  for (const change of coverageChanges) {
    if (change.from_status === "pending" && change.to_status === "covered") {
      coveredInPeriod += 1;
    } else if (
      change.from_status === "covered" &&
      change.to_status === "pending"
    ) {
      revertedInPeriod += 1;
    }
  }

  const gffsForPeriod = periodDailyStats.reduce(
    (sum, d) => sum + d.impl_for_day,
    0,
  );

  return {
    period,
    days,
    generatedAt: new Date().toISOString(),
    dateFrom,
    dateTo,
    settings,
    priorityStats,
    dailyStats,
    periodDailyStats,
    coverageChanges,
    totals: {
      changesInPeriod: coverageChanges.length,
      coveredInPeriod,
      revertedInPeriod,
      gffsForPeriod,
    },
  };
}

export function buildPeriodReportXlsx(data: PeriodReportData): Buffer {
  const wb = XLSX.utils.book_new();
  const label = periodLabel(data.period);

  const summaryRows = [
    [`GFF Development ${label} Report`],
    [`Period`, `${data.dateFrom} to ${data.dateTo}`],
    [`Generated`, data.generatedAt],
    [],
    ["KPI", "Value"],
    ["Total GFFs covered (period)", data.totals.gffsForPeriod],
    ["Coverage changes", data.totals.changesInPeriod],
    ["Pending → Covered", data.totals.coveredInPeriod],
    ["Covered → Pending", data.totals.revertedInPeriod],
    [],
    ["Priority", "Total DTCs", "Covered", "Pending", "LB74x %", "LB636 %", "LB63x %"],
    ...data.priorityStats.map((row) => [
      row.label,
      row.total_dtcs,
      row.implemented,
      row.pending,
      formatPercent(row.completion.LB74x),
      formatPercent(row.completion.LB636),
      formatPercent(row.completion.LB63x),
    ]),
  ];

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summaryRows),
    "Summary",
  );

  const dailySheet = [
    ["Date", "Total for day", "Auto", "Manual", "Cumulative covered"],
    ...data.periodDailyStats.map((d) => [
      d.stat_date,
      d.impl_for_day,
      d.impl_for_day_auto,
      d.impl_for_day_manual,
      d.implemented_count,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(dailySheet),
    "Daily stats",
  );

  const changesSheet = [
    [
      "Changed at",
      "ECU",
      "Code",
      "Symptom",
      "Project",
      "From",
      "To",
      "User",
      "Source",
    ],
    ...data.coverageChanges.map((c) => [
      c.changed_at,
      c.ecu_code,
      c.trouble_code ?? "",
      c.symptom ?? "",
      c.project,
      c.from_status,
      c.to_status,
      c.username ?? "",
      c.change_source,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(changesSheet),
    "Coverage changes",
  );

  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer,
  );
}

export function buildPeriodReportPdf(data: PeriodReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const label = periodLabel(data.period);

    doc.fontSize(20).text(`GFF Development ${label} Report`, { underline: true });
    doc.moveDown();
    doc.fontSize(11).fillColor("#444");
    doc.text(`Period: ${data.dateFrom} to ${data.dateTo}`);
    doc.text(`Generated: ${format(new Date(data.generatedAt), "yyyy-MM-dd HH:mm")}`);
    doc.moveDown();

    doc.fillColor("#000").fontSize(14).text("Summary", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`GFFs covered in period: ${formatNumber(data.totals.gffsForPeriod)}`);
    doc.text(`Coverage changes: ${formatNumber(data.totals.changesInPeriod)}`);
    doc.text(`Pending → Covered: ${formatNumber(data.totals.coveredInPeriod)}`);
    doc.text(`Covered → Pending: ${formatNumber(data.totals.revertedInPeriod)}`);
    doc.moveDown();

    doc.fontSize(14).text("Priority breakdown", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    for (const row of data.priorityStats) {
      doc.text(
        `${row.label}: ${formatNumber(row.implemented)}/${formatNumber(row.total_dtcs)} covered (${formatPercent(row.completion.LB74x)} LB74x, ${formatPercent(row.completion.LB636)} LB636, ${formatPercent(row.completion.LB63x)} LB63x)`,
      );
    }
    doc.moveDown();

    doc.fontSize(14).text("Daily stats", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    if (data.periodDailyStats.length === 0) {
      doc.text("No daily entries in this period.");
    } else {
      for (const d of data.periodDailyStats) {
        doc.text(
          `${d.stat_date}: ${d.impl_for_day} total (${d.impl_for_day_auto} auto, ${d.impl_for_day_manual} manual) — cumulative ${formatNumber(d.implemented_count)}`,
        );
      }
    }
    doc.moveDown();

    doc.fontSize(14).text("Recent coverage changes", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);
    const recent = data.coverageChanges.slice(0, 40);
    if (recent.length === 0) {
      doc.text("No coverage changes in this period.");
    } else {
      for (const c of recent) {
        doc.text(
          `${c.changed_at.slice(0, 16)} | ${c.ecu_code} | ${c.trouble_code ?? c.symptom ?? "—"} | ${c.project} ${c.from_status}→${c.to_status} | ${c.username ?? "—"}`,
        );
      }
      if (data.coverageChanges.length > 40) {
        doc.moveDown(0.5);
        doc.text(`… and ${data.coverageChanges.length - 40} more (see Excel export).`);
      }
    }

    doc.end();
  });
}
