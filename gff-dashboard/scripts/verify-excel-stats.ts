import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { resetDb, getDb } from "../src/lib/db";
import { importWorkbookFromBuffer } from "../src/lib/excel/import-workbook";
import { getEcuCompletions, getStatisticsSummary } from "../src/lib/queries";

const WORKBOOK_PATH =
  process.env.GFF_WORKBOOK ??
  path.join(process.cwd(), "..", "GFF_development - internal copy.xlsm");

const EXPECTED = {
  ecus: 62,
  dtcRows: 25086,
};

function countApplicableSlots(db: ReturnType<typeof getDb>): number {
  return (
    db
      .prepare(
        `SELECT SUM(
          CASE WHEN applicable_lb74x = 1 THEN 1 ELSE 0 END +
          CASE WHEN applicable_lb636 = 1 THEN 1 ELSE 0 END +
          CASE WHEN applicable_lb63x = 1 THEN 1 ELSE 0 END
        ) as c FROM dtcs`,
      )
      .get() as { c: number | null }
  ).c ?? 0;
}

function readExcelTotals() {
  const buffer = fs.readFileSync(WORKBOOK_PATH);
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Statistiche, {
    header: 1,
    defval: null,
  }) as unknown[][];

  return {
    TOT: rows[1],
    Prio1: rows[2],
    Prio2: rows[3],
    Prio3: rows[4],
  };
}

function main() {
  if (!fs.existsSync(WORKBOOK_PATH)) {
    throw new Error(`Workbook not found: ${WORKBOOK_PATH}`);
  }

  resetDb();
  const summary = importWorkbookFromBuffer(fs.readFileSync(WORKBOOK_PATH));

  const db = getDb();
  const ecuCount = (db.prepare("SELECT COUNT(*) as c FROM ecus").get() as { c: number })
    .c;
  const dtcRows = (db.prepare("SELECT COUNT(*) as c FROM dtcs").get() as { c: number })
    .c;

  const { priorityStats } = getStatisticsSummary();
  const ecuCompletions = getEcuCompletions();
  const excelRows = readExcelTotals();

  let failed = false;

  if (ecuCount !== EXPECTED.ecus) {
    console.error(`ECUs: ${ecuCount} (expected ${EXPECTED.ecus})`);
    failed = true;
  } else {
    console.log(`ECUs: ${ecuCount}`);
  }

  if (dtcRows !== EXPECTED.dtcRows) {
    console.error(`DTC rows: ${dtcRows} (expected ${EXPECTED.dtcRows})`);
    failed = true;
  } else {
    console.log(`DTC rows: ${dtcRows}`);
  }

  if (summary.coverageSlots <= 0) {
    console.error(`Coverage slots: invalid count ${summary.coverageSlots}`);
    failed = true;
  } else {
    console.log(`Coverage slots: ${summary.coverageSlots}`);
  }

  const applicableSlots = countApplicableSlots(db);
  if (summary.coverageSlots !== applicableSlots) {
    console.error(
      `Coverage slots mismatch: import=${summary.coverageSlots}, sql=${applicableSlots}`,
    );
    failed = true;
  }

  let dashTotal = 0;
  let dashCovered = 0;
  for (const ecu of ecuCompletions) {
    for (const project of ["LB74x", "LB636", "LB63x"] as const) {
      const stats = ecu.projects[project];
      if (!stats) continue;
      dashTotal += stats.total;
      dashCovered += stats.covered;
    }
  }

  if (dashTotal !== applicableSlots) {
    console.error(
      `Dashboard slot total: ${dashTotal} (expected ${applicableSlots})`,
    );
    failed = true;
  }

  for (const label of ["TOT"] as const) {
    const row = priorityStats.find((item) => item.label === label);
    const excel = excelRows[label] as number[];

    if (!row) {
      console.error(`${label}: missing from dashboard stats`);
      failed = true;
      continue;
    }

    const pct = (row.implemented / row.total_dtcs) * 100;
    const excelPct = excel?.[1] ? (excel[2] / excel[1]) * 100 : 0;
    const totOk = row.total_dtcs === applicableSlots;
    const balanceOk =
      row.implemented + row.pending + row.faulty === row.total_dtcs;

    console.log(
      `${label}: total=${row.total_dtcs}${totOk ? "" : ` (expected ${applicableSlots})`}, ` +
        `covered=${row.implemented}, pending=${row.pending}, faulty=${row.faulty}, ` +
        `pct=${pct.toFixed(2)}%`,
    );

    if (!totOk || !balanceOk) {
      failed = true;
    }

    if (excel?.[1] != null) {
      const excelDiffers = excel[1] !== row.total_dtcs;
      console.log(
        `  Excel Statistiche row: total=${excel[1]}, covered=${excel[2]}, pending=${excel[3]}, pct=${excelPct.toFixed(2)}%` +
          (excelDiffers
            ? " (may differ: Excel TOT counts gff_available=y slots only)"
            : ""),
      );
    }
  }

  if (failed) {
    console.error("\nVerification failed.");
    process.exit(1);
  }

  console.log(
    "\nECU count, DTC rows, coverage slots, and dashboard aggregation are internally consistent.",
  );
}

main();
