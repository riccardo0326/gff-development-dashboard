#!/usr/bin/env node
/**
 * Imports data from the GFF Excel workbook into SQLite.
 * Usage: npm run import
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const DEFAULT_XLSM = path.join(
  ROOT,
  "..",
  "GFF_development - internal copy.xlsm",
);
const XLSM_PATH = process.env.GFF_XLSM_PATH ?? DEFAULT_XLSM;
const DB_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DB_DIR, "gff.db");

function normalizeDaCode(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return value.toString(16).toUpperCase().padStart(4, "0");
  }
  const text = String(value).trim().toUpperCase();
  if (/^\d+$/.test(text)) return text.padStart(4, "0");
  return text.replace(/^DA/, "");
}

function toDaId(code) {
  return `DA${code}`;
}

function mapCoverage(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim().toLowerCase();
  if (text === "used") return "covered";
  if (text === "x") return "pending";
  if (text.includes("np")) return null;
  return null;
}

function cellString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function excelDateToIso(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const mm = String(parsed.m).padStart(2, "0");
    const dd = String(parsed.d).padStart(2, "0");
    return `${parsed.y}-${mm}-${dd}`;
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ecus (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      priority INTEGER NOT NULL,
      lb74x_applicable INTEGER NOT NULL DEFAULT 1,
      lb636_applicable INTEGER NOT NULL DEFAULT 1,
      lb63x_applicable INTEGER NOT NULL DEFAULT 1,
      odx_lb74x TEXT,
      odx_lb636 TEXT,
      odx_lb63x TEXT
    );

    CREATE TABLE IF NOT EXISTS dtcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecu_id TEXT NOT NULL,
      symptom TEXT,
      trouble_code TEXT,
      dtc_text TEXT,
      error_handling TEXT,
      error_setting_conditions TEXT,
      gff_program TEXT,
      category INTEGER,
      label INTEGER,
      coverage_lb74x TEXT,
      coverage_lb636 TEXT,
      coverage_lb63x TEXT
    );

    CREATE TABLE IF NOT EXISTS faulty_dtcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symptom TEXT,
      trouble_code TEXT,
      dtc_text TEXT,
      issue_description TEXT,
      ev_name TEXT,
      da_code TEXT,
      projects_impacted TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stat_date TEXT NOT NULL UNIQUE,
      implemented_count INTEGER NOT NULL,
      impl_for_day INTEGER NOT NULL
    );
  `);
}

function clearData(db) {
  db.exec(`
    DELETE FROM dtcs;
    DELETE FROM faulty_dtcs;
    DELETE FROM daily_stats;
    DELETE FROM ecus;
    DELETE FROM settings;
    DELETE FROM vehicle_projects;
  `);
}

function seedProjects(db) {
  const insert = db.prepare(
    "INSERT INTO vehicle_projects (id, name, sort_order) VALUES (?, ?, ?)",
  );
  insert.run("LB74x", "LB74x", 1);
  insert.run("LB636", "LB636", 2);
  insert.run("LB63x", "LB63x", 3);
}

function importDashboard(db, workbook) {
  const sheet = workbook.Sheets.Dashboard;
  if (!sheet) throw new Error("Dashboard sheet not found");

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
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

function importEcuSheet(db, sheetName, sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const ecuId = sheetName;

  const odxLb74x = cellString(rows[0]?.[1]);
  const odxLb636 = cellString(rows[1]?.[1]);
  const odxLb63x = cellString(rows[2]?.[1]);

  db.prepare(
    "UPDATE ecus SET odx_lb74x = ?, odx_lb636 = ?, odx_lb63x = ? WHERE id = ?",
  ).run(odxLb74x, odxLb636, odxLb63x, ecuId);

  const insert = db.prepare(`
    INSERT INTO dtcs (
      ecu_id, symptom, trouble_code, dtc_text, error_handling,
      error_setting_conditions, gff_program, category, label,
      coverage_lb74x, coverage_lb636, coverage_lb63x
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    if (!row || (!row[0] && !row[1] && !row[2])) continue;

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

    insert.run(
      ecuId,
      cellString(row[0]),
      cellString(row[1]),
      cellString(row[2]),
      cellString(row[3]),
      cellString(row[4]),
      cellString(row[5]),
      Number.isFinite(category) ? category : null,
      Number.isFinite(label) ? label : null,
      mapCoverage(row[7]),
      mapCoverage(row[8]),
      mapCoverage(row[9]),
    );
    count += 1;
  }

  return count;
}

function importFaulty(db, workbook) {
  const sheet = workbook.Sheets.DTCs_faulty;
  if (!sheet) return 0;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
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

function importStatistics(db, workbook) {
  const sheet = workbook.Sheets.Statistiche;
  if (!sheet) return { daily: 0 };

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const dailyEstimate = Number(rows[1]?.[4] ?? 50);
  const baselineImplemented = Number(rows[28]?.[1] ?? 22167);
  const startDate =
    excelDateToIso(rows[28]?.[0]) ??
    new Date().toISOString().slice(0, 10);

  const settingsInsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?)",
  );
  settingsInsert.run("daily_estimate", String(dailyEstimate));
  settingsInsert.run("forecast_start_date", startDate);
  settingsInsert.run("baseline_implemented", String(baselineImplemented));

  const dailyInsert = db.prepare(`
    INSERT INTO daily_stats (stat_date, implemented_count, impl_for_day)
    VALUES (?, ?, ?)
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

    dailyInsert.run(dateIso, cumulative, implForDay);
    dailyCount += 1;
  }

  return { daily: dailyCount, dailyEstimate, baselineImplemented, startDate };
}

function main() {
  if (!fs.existsSync(XLSM_PATH)) {
    console.error(`Excel file not found: ${XLSM_PATH}`);
    process.exit(1);
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  console.log(`Reading ${XLSM_PATH}`);
  const workbook = XLSX.readFile(XLSM_PATH, { cellDates: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initSchema(db);
  clearData(db);
  seedProjects(db);

  const ecuCount = importDashboard(db, workbook);
  console.log(`Imported ${ecuCount} ECUs from Dashboard`);

  let dtcCount = 0;
  for (const sheetName of workbook.SheetNames) {
    if (!sheetName.startsWith("DA")) continue;
    const count = importEcuSheet(db, sheetName, workbook.Sheets[sheetName]);
    dtcCount += count;
  }
  console.log(`Imported ${dtcCount} DTC rows from ECU sheets`);

  const faultyCount = importFaulty(db, workbook);
  console.log(`Imported ${faultyCount} faulty DTC rows`);

  const stats = importStatistics(db, workbook);
  console.log(
    `Imported ${stats.daily} daily stat rows (estimate=${stats.dailyEstimate}, baseline=${stats.baselineImplemented})`,
  );

  const summary = db
    .prepare(
      "SELECT (SELECT COUNT(*) FROM ecus) AS ecus, (SELECT COUNT(*) FROM dtcs) AS dtcs, (SELECT COUNT(*) FROM faulty_dtcs) AS faulty",
    )
    .get();

  db.close();
  console.log("Import complete:", summary);
  console.log(`Database written to ${DB_PATH}`);
}

main();
