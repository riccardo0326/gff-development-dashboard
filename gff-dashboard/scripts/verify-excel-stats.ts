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
  TOT: { total: 53705, implemented: 25847, pending: 27755, pct: 48.13 },
};

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

  if (summary.coverageSlots !== EXPECTED.TOT.total) {
    console.error(
      `Coverage slots: ${summary.coverageSlots} (expected ${EXPECTED.TOT.total})`,
    );
    failed = true;
  } else {
    console.log(`Coverage slots: ${summary.coverageSlots}`);
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

  if (dashTotal !== EXPECTED.TOT.total) {
    console.error(
      `Dashboard slot total: ${dashTotal} (expected ${EXPECTED.TOT.total})`,
    );
    failed = true;
  }

  for (const label of ["TOT"] as const) {
    const row = priorityStats.find((item) => item.label === label);
    const expected = EXPECTED[label];
    const excel = excelRows[label] as number[];

    if (!row) {
      console.error(`${label}: missing from dashboard stats`);
      failed = true;
      continue;
    }

    const pct = (row.implemented / row.total_dtcs) * 100;
    const excelPct = (excel[2] / excel[1]) * 100;
    const totOk = row.total_dtcs === expected.total;
    const implOk = row.implemented === expected.implemented;
    const pendOk = row.pending === expected.pending;
    const pctOk = Math.abs(pct - expected.pct) < 0.05;

    console.log(
      `${label}: total=${row.total_dtcs}${totOk ? "" : ` (expected ${expected.total})`}, ` +
        `covered=${row.implemented}${implOk ? "" : ` (expected ${expected.implemented})`}, ` +
        `pending=${row.pending}${pendOk ? "" : ` (expected ${expected.pending})`}, ` +
        `pct=${pct.toFixed(2)}%${pctOk ? "" : ` (expected ${expected.pct.toFixed(2)}%)`}`,
    );

    if (!totOk || !implOk || !pendOk || !pctOk) {
      failed = true;
    }

    if (excel[1] !== expected.total || excel[2] !== expected.implemented) {
      console.log(
        `  Excel sheet row: total=${excel[1]}, covered=${excel[2]}, pending=${excel[3]}, pct=${excelPct.toFixed(2)}%`,
      );
    }
  }

  if (failed) {
    console.error("\nVerification failed.");
    process.exit(1);
  }

  console.log("\nECU count, DTC rows, coverage slots, and dashboard aggregation match Excel.");
}

main();
