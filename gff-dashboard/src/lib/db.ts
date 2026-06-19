import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "gff.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ecus (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 3),
      lb74x_applicable INTEGER NOT NULL DEFAULT 1,
      lb636_applicable INTEGER NOT NULL DEFAULT 1,
      lb63x_applicable INTEGER NOT NULL DEFAULT 1,
      odx_lb74x TEXT,
      odx_lb636 TEXT,
      odx_lb63x TEXT
    );

    CREATE TABLE IF NOT EXISTS dtcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecu_id TEXT NOT NULL REFERENCES ecus(id) ON DELETE CASCADE,
      symptom TEXT,
      trouble_code TEXT,
      dtc_text TEXT,
      error_handling TEXT,
      error_setting_conditions TEXT,
      gff_program TEXT,
      category INTEGER,
      label INTEGER,
      coverage_lb74x TEXT CHECK(coverage_lb74x IN ('pending', 'covered')),
      coverage_lb636 TEXT CHECK(coverage_lb636 IN ('pending', 'covered')),
      coverage_lb63x TEXT CHECK(coverage_lb63x IN ('pending', 'covered'))
    );

    CREATE INDEX IF NOT EXISTS idx_dtcs_ecu ON dtcs(ecu_id);
    CREATE INDEX IF NOT EXISTS idx_dtcs_category ON dtcs(category);
    CREATE INDEX IF NOT EXISTS idx_dtcs_trouble_code ON dtcs(trouble_code);

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

    CREATE INDEX IF NOT EXISTS idx_faulty_da ON faulty_dtcs(da_code);
    CREATE INDEX IF NOT EXISTS idx_faulty_issue ON faulty_dtcs(issue_description);

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

    CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_stats(stat_date);
  `);

  const projectCount = database
    .prepare("SELECT COUNT(*) as c FROM vehicle_projects")
    .get() as { c: number };

  if (projectCount.c === 0) {
    const insert = database.prepare(
      "INSERT INTO vehicle_projects (id, name, sort_order) VALUES (?, ?, ?)",
    );
    insert.run("LB74x", "LB74x", 1);
    insert.run("LB636", "LB636", 2);
    insert.run("LB63x", "LB63x", 3);
  }

  const settingsCount = database
    .prepare("SELECT COUNT(*) as c FROM settings")
    .get() as { c: number };

  if (settingsCount.c === 0) {
    const insert = database.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?)",
    );
    insert.run("daily_estimate", "50");
    insert.run("forecast_start_date", "2026-03-26");
    insert.run("baseline_implemented", "22167");
  }
}

export function resetDb() {
  if (db) {
    db.close();
    db = null;
  }
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
}
