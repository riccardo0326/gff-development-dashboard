import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { parseSettings } from "../calculations";
import { getDb } from "../db";
import type { DailyStat, Dtc, Ecu, FaultyDtc, Settings } from "../types";
import { isoToExcelDate } from "./dates";
import { mapExportCoverage, mapExportGffAvailable } from "./mappers";

const TEMPLATE_CANDIDATES = [
  path.join(process.cwd(), "templates", "workbook-template.xlsm"),
  path.join(process.cwd(), "..", "GFF_development - internal copy.xlsm"),
];

function resolveTemplatePath(): string {
  for (const candidate of TEMPLATE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Workbook template not found. Checked: ${TEMPLATE_CANDIDATES.join(", ")}`,
  );
}

function setCell(
  sheet: XLSX.WorkSheet,
  address: string,
  value: string | number | Date | null,
) {
  if (value === null || value === "") {
    delete sheet[address];
    return;
  }
  sheet[address] = {
    t: value instanceof Date ? "d" : typeof value === "number" ? "n" : "s",
    v: value,
  };
}

function updateEcuSheet(sheet: XLSX.WorkSheet, ecu: Ecu, dtcs: Dtc[]) {
  if (ecu.odx_lb74x) setCell(sheet, "B1", ecu.odx_lb74x);
  if (ecu.odx_lb636) setCell(sheet, "B2", ecu.odx_lb636);
  if (ecu.odx_lb63x) setCell(sheet, "B3", ecu.odx_lb63x);

  dtcs.forEach((dtc, index) => {
    const row = index + 5;
    setCell(sheet, `A${row}`, dtc.symptom);
    setCell(sheet, `B${row}`, dtc.trouble_code);
    setCell(sheet, `C${row}`, dtc.dtc_text);
    setCell(sheet, `D${row}`, dtc.error_handling);
    setCell(sheet, `E${row}`, dtc.error_setting_conditions);
    setCell(sheet, `F${row}`, mapExportGffAvailable(dtc.gff_available));
    setCell(sheet, `G${row}`, dtc.gff_program);
    setCell(sheet, `H${row}`, mapExportCoverage(dtc.coverage_lb74x, !!dtc.applicable_lb74x));
    setCell(sheet, `I${row}`, mapExportCoverage(dtc.coverage_lb636, !!dtc.applicable_lb636));
    setCell(sheet, `J${row}`, mapExportCoverage(dtc.coverage_lb63x, !!dtc.applicable_lb63x));
    if (dtc.category != null) setCell(sheet, `K${row}`, dtc.category);
    if (dtc.label != null) setCell(sheet, `L${row}`, dtc.label);
  });
}

function updateStatisticsSheet(
  sheet: XLSX.WorkSheet,
  settings: Settings,
  dailyStats: DailyStat[],
) {
  setCell(sheet, "E2", settings.daily_estimate);

  dailyStats.forEach((row, index) => {
    const excelRow = 29 + index;
    setCell(sheet, `A${excelRow}`, isoToExcelDate(row.stat_date));
    setCell(sheet, `B${excelRow}`, row.implemented_count);
    setCell(sheet, `D${excelRow}`, row.impl_for_day);
  });
}

function updateFaultySheet(sheet: XLSX.WorkSheet, rows: FaultyDtc[]) {
  rows.forEach((row, index) => {
    const excelRow = index + 2;
    setCell(sheet, `A${excelRow}`, row.symptom);
    setCell(sheet, `B${excelRow}`, row.trouble_code);
    setCell(sheet, `C${excelRow}`, row.dtc_text);
    setCell(sheet, `D${excelRow}`, row.issue_description);
    setCell(sheet, `E${excelRow}`, row.ev_name);
    setCell(sheet, `F${excelRow}`, row.da_code);
    setCell(sheet, `G${excelRow}`, row.projects_impacted);
  });
}

export function exportWorkbookToBuffer(): Buffer {
  const templatePath = resolveTemplatePath();
  const templateBuffer = fs.readFileSync(templatePath);
  const workbook = XLSX.read(templateBuffer, {
    type: "buffer",
    bookVBA: true,
    cellDates: true,
  });

  const db = getDb();
  const ecus = db.prepare("SELECT * FROM ecus ORDER BY code ASC").all() as Ecu[];
  const dtcStmt = db.prepare(
    "SELECT * FROM dtcs WHERE ecu_id = ? ORDER BY id ASC",
  );
  const faulty = db
    .prepare("SELECT * FROM faulty_dtcs ORDER BY id ASC")
    .all() as FaultyDtc[];
  const dailyStats = db
    .prepare("SELECT * FROM daily_stats ORDER BY stat_date ASC")
    .all() as DailyStat[];

  const settingsRows = db
    .prepare("SELECT key, value FROM settings")
    .all() as Array<{ key: string; value: string }>;
  const settingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  const settings = parseSettings(settingsMap);

  for (const ecu of ecus) {
    const sheet = workbook.Sheets[ecu.id];
    if (!sheet) continue;
    const dtcs = dtcStmt.all(ecu.id) as Dtc[];
    updateEcuSheet(sheet, ecu, dtcs);
  }

  if (workbook.Sheets.Statistiche) {
    updateStatisticsSheet(workbook.Sheets.Statistiche, settings, dailyStats);
  }

  if (workbook.Sheets.DTCs_faulty) {
    updateFaultySheet(workbook.Sheets.DTCs_faulty, faulty);
  }

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsm",
    bookVBA: true,
    cellDates: true,
  }) as Buffer;
}

export function exportFaultyToBuffer(rows: FaultyDtc[]): Buffer {
  const header = [
    "DTC symptom",
    "DTC trouble code",
    "DTC text",
    "DTC issue description",
    "EV name",
    "DA",
    "Project impacted",
  ];

  const data = rows.map((row) => [
    row.symptom ?? "",
    row.trouble_code ?? "",
    row.dtc_text ?? "",
    row.issue_description ?? "",
    row.ev_name ?? "",
    row.da_code ?? "",
    row.projects_impacted ?? "",
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([header, ...data]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "DTCs_faulty");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
