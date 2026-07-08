import type { WorkBook } from "xlsx";
import * as XLSX from "xlsx";
import { getDb } from "../db";
import { todayIsoDate } from "../datetime";
import { excelDateToIso } from "./dates";
import {
  cellString,
  classifyCoverageCell,
  normalizeDaCode,
  parseGffAvailable,
  toDaId,
} from "./mappers";

export interface ImportSummary {
  ecus: number;
  /** One row per DTC identity on an ECU sheet. */
  dtcs: number;
  /** Applicable coverage slots (LB74x / LB636 / LB63x cells per DTC). */
  coverageSlots: number;
  faulty: number;
  daily: number;
  dailyEstimate: number;
  baselineImplemented: number;
  startDate: string;
}

function clearAllData(db: ReturnType<typeof getDb>) {
  db.exec(`
    DELETE FROM coverage_changes;
    DELETE FROM dtcs;
    DELETE FROM faulty_dtcs;
    DELETE FROM daily_stats;
    DELETE FROM ecus;
    DELETE FROM settings;
    DELETE FROM vehicle_projects;
  `);
}

function seedProjects(db: ReturnType<typeof getDb>) {
  const insert = db.prepare(
    "INSERT INTO vehicle_projects (id, name, sort_order) VALUES (?, ?, ?)",
  );
  insert.run("LB74x", "LB74x", 1);
  insert.run("LB636", "LB636", 2);
  insert.run("LB63x", "LB63x", 3);
}

function importDashboard(db: ReturnType<typeof getDb>, workbook: WorkBook) {
  const sheet = workbook.Sheets.Dashboard;
  if (!sheet) throw new Error("Dashboard sheet not found");

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  const insert = db.prepare(`
    INSERT INTO ecus (
      id, code, priority,
      lb74x_applicable, lb636_applicable, lb63x_applicable
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const code = normalizeDaCode(row[0]);
    if (!code) continue;

    const priority = Number(row[1]);
    if (!priority || priority < 1 || priority > 3) continue;

    const lb74x = String(row[3] ?? "").trim().toLowerCase() !== "n.a.";
    const lb636 = String(row[4] ?? "").trim().toLowerCase() !== "n.a.";
    const lb63x = String(row[5] ?? "").trim().toLowerCase() !== "n.a.";

    insert.run(
      toDaId(code),
      code,
      priority,
      lb74x ? 1 : 0,
      lb636 ? 1 : 0,
      lb63x ? 1 : 0,
    );
    count += 1;
  }

  return count;
}

function importEcuSheet(
  db: ReturnType<typeof getDb>,
  sheetName: string,
  sheet: XLSX.WorkSheet,
) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  const ecuId = sheetName;
  const code = ecuId.replace(/^DA/, "");

  const ecuExists = db
    .prepare("SELECT 1 FROM ecus WHERE id = ?")
    .get(ecuId);
  if (!ecuExists) {
    db.prepare(`
      INSERT INTO ecus (
        id, code, priority,
        lb74x_applicable, lb636_applicable, lb63x_applicable
      ) VALUES (?, ?, 3, 1, 1, 1)
    `).run(ecuId, code);
  }

  const odxLb74x = cellString(rows[0]?.[1]);
  const odxLb636 = cellString(rows[1]?.[1]);
  const odxLb63x = cellString(rows[2]?.[1]);

  db.prepare(
    "UPDATE ecus SET odx_lb74x = ?, odx_lb636 = ?, odx_lb63x = ? WHERE id = ?",
  ).run(odxLb74x, odxLb636, odxLb63x, ecuId);

  const insert = db.prepare(`
    INSERT INTO dtcs (
      ecu_id, symptom, trouble_code, dtc_text, error_handling,
      error_setting_conditions, gff_available, gff_program, category, label,
      coverage_lb74x, coverage_lb636, coverage_lb63x,
      applicable_lb74x, applicable_lb636, applicable_lb63x
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    const hasIdentity = !!(row?.[0] || row?.[1] || row?.[2]);
    const hasCoverage = [7, 8, 9].some((col) => {
      const value = row?.[col];
      return value !== null && value !== undefined && value !== "";
    });
    if (!row || (!hasIdentity && !hasCoverage)) continue;

    const categoryRaw = row[10];
    const labelRaw = row[11];
    const category =
      categoryRaw === null || categoryRaw === undefined || categoryRaw === ""
        ? null
        : Number(categoryRaw);
    const label =
      labelRaw === null || labelRaw === undefined || labelRaw === ""
        ? null
        : Number(labelRaw);

    const lb74x = classifyCoverageCell(row[7]);
    const lb636 = classifyCoverageCell(row[8]);
    const lb63x = classifyCoverageCell(row[9]);

    insert.run(
      ecuId,
      cellString(row[0]),
      cellString(row[1]),
      cellString(row[2]),
      cellString(row[3]),
      cellString(row[4]),
      parseGffAvailable(row[5]),
      cellString(row[6]),
      Number.isFinite(category) ? category : null,
      Number.isFinite(label) ? label : null,
      lb74x.status,
      lb636.status,
      lb63x.status,
      lb74x.applicable ? 1 : 0,
      lb636.applicable ? 1 : 0,
      lb63x.applicable ? 1 : 0,
    );
    count += 1;
  }

  return count;
}

function importFaulty(db: ReturnType<typeof getDb>, workbook: WorkBook) {
  const sheet = workbook.Sheets.DTCs_faulty;
  if (!sheet) return 0;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  const insert = db.prepare(`
    INSERT INTO faulty_dtcs (
      symptom, trouble_code, dtc_text, issue_description,
      ev_name, da_code, projects_impacted
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row?.[0] && !row?.[1]) continue;
    insert.run(
      cellString(row[0]),
      cellString(row[1]),
      cellString(row[2]),
      cellString(row[3]),
      cellString(row[4]),
      cellString(row[5]),
      cellString(row[6]),
    );
    count += 1;
  }
  return count;
}

function importStatistics(db: ReturnType<typeof getDb>, workbook: WorkBook) {
  const sheet = workbook.Sheets.Statistiche;
  if (!sheet) {
    return {
      daily: 0,
      dailyEstimate: 50,
      baselineImplemented: 22167,
      startDate: todayIsoDate(),
    };
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  const dailyEstimate = Number(rows[1]?.[4] ?? 50);
  const baselineImplemented = Number(rows[28]?.[1] ?? 22167);
  const startDate =
    excelDateToIso(rows[28]?.[0]) ??
    todayIsoDate();

  const settingsInsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?)",
  );
  settingsInsert.run("daily_estimate", String(dailyEstimate));
  settingsInsert.run("forecast_start_date", startDate);
  settingsInsert.run("baseline_implemented", String(baselineImplemented));

  const dailyInsert = db.prepare(`
    INSERT INTO daily_stats (
      stat_date, implemented_count, impl_for_day,
      impl_for_day_auto, impl_for_day_manual
    ) VALUES (?, ?, ?, 0, ?)
  `);

  let dailyCount = 0;
  let cumulative = baselineImplemented;

  for (let i = 28; i < rows.length; i++) {
    const row = rows[i];
    const dateIso = excelDateToIso(row[0]);
    const implForDay = Number(row[3]);
    const implementedFromSheet = Number(row[1]);

    if (!dateIso || !Number.isFinite(implForDay)) continue;

    if (Number.isFinite(implementedFromSheet) && implementedFromSheet > 0) {
      cumulative = implementedFromSheet;
    } else if (dailyCount > 0) {
      cumulative += implForDay;
    }

    dailyInsert.run(dateIso, cumulative, implForDay, implForDay);
    dailyCount += 1;
  }

  return { daily: dailyCount, dailyEstimate, baselineImplemented, startDate };
}

export function importWorkbookFromBuffer(buffer: Buffer): ImportSummary {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  return importWorkbook(workbook);
}

export function importWorkbook(workbook: WorkBook): ImportSummary {
  const db = getDb();

  const importTx = db.transaction(() => {
    clearAllData(db);
    seedProjects(db);

    importDashboard(db, workbook);

    let dtcCount = 0;
    for (const sheetName of workbook.SheetNames) {
      if (!sheetName.startsWith("DA")) continue;
      const count = importEcuSheet(db, sheetName, workbook.Sheets[sheetName]);
      dtcCount += count;
    }

    const faultyCount = importFaulty(db, workbook);
    const stats = importStatistics(db, workbook);

    const actualEcuCount = (
      db.prepare("SELECT COUNT(*) as c FROM ecus").get() as { c: number }
    ).c;
    const coverageSlots = (
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

    return {
      ecus: actualEcuCount,
      dtcs: dtcCount,
      coverageSlots,
      faulty: faultyCount,
      daily: stats.daily,
      dailyEstimate: stats.dailyEstimate,
      baselineImplemented: stats.baselineImplemented,
      startDate: stats.startDate,
    };
  });

  return importTx();
}
