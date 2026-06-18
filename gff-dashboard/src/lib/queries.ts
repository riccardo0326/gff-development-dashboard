import { getDb } from "./db";
import {
  buildForecastTable,
  buildPriorityStats,
  computeEcuProjectCompletion,
  parseSettings,
} from "./calculations";
import type {
  DailyStat,
  Dtc,
  Ecu,
  EcuCompletion,
  FaultyDtc,
  Settings,
  VehicleProjectId,
} from "./types";

export function getSettings(): Settings {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return parseSettings(map);
}

export function updateSettings(partial: Partial<Settings>): Settings {
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );

  if (partial.daily_estimate !== undefined) {
    insert.run("daily_estimate", String(partial.daily_estimate));
  }
  if (partial.forecast_start_date !== undefined) {
    insert.run("forecast_start_date", partial.forecast_start_date);
  }
  if (partial.baseline_implemented !== undefined) {
    insert.run("baseline_implemented", String(partial.baseline_implemented));
  }

  return getSettings();
}

export function getEcus(filters?: {
  priority?: number;
  search?: string;
}): Ecu[] {
  const db = getDb();
  let query = "SELECT * FROM ecus WHERE 1=1";
  const params: Array<string | number> = [];

  if (filters?.priority) {
    query += " AND priority = ?";
    params.push(filters.priority);
  }
  if (filters?.search) {
    query += " AND (code LIKE ? OR id LIKE ?)";
    const term = `%${filters.search}%`;
    params.push(term, term);
  }

  query += " ORDER BY priority ASC, code ASC";
  return db.prepare(query).all(...params) as Ecu[];
}

export function getEcuById(id: string): Ecu | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM ecus WHERE id = ?").get(id) as Ecu) ?? null;
}

export function getEcuCompletions(filters?: {
  priority?: number;
  search?: string;
}): EcuCompletion[] {
  const ecus = getEcus(filters);
  const db = getDb();

  const stmt = db.prepare(`
    SELECT coverage_lb74x, coverage_lb636, coverage_lb63x
    FROM dtcs WHERE ecu_id = ?
  `);

  return ecus.map((ecu) => ({
    ...ecu,
    projects: computeEcuProjectCompletion(
      ecu,
      stmt.all(ecu.id) as Array<{
        coverage_lb74x: string | null;
        coverage_lb636: string | null;
        coverage_lb63x: string | null;
      }>,
    ),
  }));
}

export function getAllCoverageRows() {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT d.coverage_lb74x, d.coverage_lb636, d.coverage_lb63x,
             d.ecu_id, e.priority
      FROM dtcs d
      JOIN ecus e ON e.id = d.ecu_id
    `,
    )
    .all() as Array<{
    coverage_lb74x: string | null;
    coverage_lb636: string | null;
    coverage_lb63x: string | null;
    ecu_id: string;
    priority: number;
  }>;
}

export function getStatisticsSummary() {
  const ecus = getEcus();
  const rows = getAllCoverageRows();
  const settings = getSettings();
  const dailyStats = getDailyStats();
  const priorityStats = buildPriorityStats(ecus, rows, settings, dailyStats);
  const totalRow = priorityStats.find((r) => r.label === "TOT");
  const forecast = buildForecastTable(
    totalRow?.total_dtcs ?? 0,
    settings,
    dailyStats,
  );

  return { priorityStats, forecast, settings, dailyStats };
}

export function getDailyStats(): DailyStat[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM daily_stats ORDER BY stat_date ASC")
    .all() as DailyStat[];
}

export function addDailyStat(input: {
  stat_date: string;
  impl_for_day: number;
}): DailyStat {
  const db = getDb();
  const last = db
    .prepare("SELECT * FROM daily_stats ORDER BY stat_date DESC LIMIT 1")
    .get() as DailyStat | undefined;

  const settings = getSettings();
  const implemented_count =
    (last?.implemented_count ?? settings.baseline_implemented) +
    input.impl_for_day;

  const result = db
    .prepare(
      `
      INSERT INTO daily_stats (stat_date, implemented_count, impl_for_day)
      VALUES (?, ?, ?)
      ON CONFLICT(stat_date) DO UPDATE SET
        implemented_count = excluded.implemented_count,
        impl_for_day = excluded.impl_for_day
      RETURNING *
    `,
    )
    .get(input.stat_date, implemented_count, input.impl_for_day) as DailyStat;

  return result;
}

const PROJECT_COLUMN: Record<
  VehicleProjectId,
  "coverage_lb74x" | "coverage_lb636" | "coverage_lb63x"
> = {
  LB74x: "coverage_lb74x",
  LB636: "coverage_lb636",
  LB63x: "coverage_lb63x",
};

export function getDtcsForEcu(
  ecuId: string,
  filters?: {
    search?: string;
    category?: number;
    coverage?: "pending" | "covered";
    project?: VehicleProjectId;
  },
  pagination?: { page: number; pageSize: number },
) {
  const db = getDb();
  let query = "SELECT * FROM dtcs WHERE ecu_id = ?";
  const params: Array<string | number> = [ecuId];

  if (filters?.search) {
    query += ` AND (
      symptom LIKE ? OR trouble_code LIKE ? OR dtc_text LIKE ?
      OR gff_program LIKE ? OR CAST(category AS TEXT) LIKE ?
    )`;
    const term = `%${filters.search}%`;
    params.push(term, term, term, term, term);
  }

  if (filters?.category !== undefined) {
    query += " AND category = ?";
    params.push(filters.category);
  }

  if (filters?.project && filters?.coverage) {
    query += ` AND ${PROJECT_COLUMN[filters.project]} = ?`;
    params.push(filters.coverage);
  } else if (filters?.coverage) {
    query +=
      " AND (coverage_lb74x = ? OR coverage_lb636 = ? OR coverage_lb63x = ?)";
    params.push(filters.coverage, filters.coverage, filters.coverage);
  }

  const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as count");
  const total = (
    db.prepare(countQuery).get(...params) as { count: number }
  ).count;

  query += " ORDER BY id ASC";
  if (pagination) {
    query += " LIMIT ? OFFSET ?";
    params.push(pagination.pageSize, (pagination.page - 1) * pagination.pageSize);
  }

  const items = db.prepare(query).all(...params) as Dtc[];
  return { items, total };
}

export function updateDtcCoverage(
  dtcId: number,
  project: VehicleProjectId,
  status: "pending" | "covered" | null,
): Dtc | null {
  const db = getDb();
  const column = PROJECT_COLUMN[project];
  const existing = db
    .prepare("SELECT * FROM dtcs WHERE id = ?")
    .get(dtcId) as Dtc | undefined;
  if (!existing) return null;

  const currentValue = existing[column];
  if (status === null && currentValue === null) {
    return existing;
  }

  db.prepare(`UPDATE dtcs SET ${column} = ? WHERE id = ?`).run(status, dtcId);
  return db.prepare("SELECT * FROM dtcs WHERE id = ?").get(dtcId) as Dtc;
}

export function getFaultyDtcs(filters?: {
  search?: string;
  da_code?: string;
  issue?: string;
  page?: number;
  pageSize?: number;
}) {
  const db = getDb();
  let query = "SELECT * FROM faulty_dtcs WHERE 1=1";
  const params: Array<string | number> = [];

  if (filters?.search) {
    query += ` AND (
      symptom LIKE ? OR trouble_code LIKE ? OR dtc_text LIKE ?
      OR issue_description LIKE ? OR ev_name LIKE ?
    )`;
    const term = `%${filters.search}%`;
    params.push(term, term, term, term, term);
  }
  if (filters?.da_code) {
    query += " AND da_code LIKE ?";
    params.push(`%${filters.da_code}%`);
  }
  if (filters?.issue) {
    query += " AND issue_description LIKE ?";
    params.push(`%${filters.issue}%`);
  }

  const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as count");
  const total = (
    db.prepare(countQuery).get(...params) as { count: number }
  ).count;

  query += " ORDER BY id ASC";
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  query += " LIMIT ? OFFSET ?";
  params.push(pageSize, (page - 1) * pageSize);

  const items = db.prepare(query).all(...params) as FaultyDtc[];
  return { items, total, page, pageSize };
}

export function getCategoriesForEcu(ecuId: string): number[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT DISTINCT category FROM dtcs WHERE ecu_id = ? AND category IS NOT NULL ORDER BY category ASC",
    )
    .all(ecuId) as Array<{ category: number }>;
  return rows.map((r) => r.category);
}

export function getFaultyFilterOptions() {
  const db = getDb();
  const daCodes = db
    .prepare(
      "SELECT DISTINCT da_code FROM faulty_dtcs WHERE da_code IS NOT NULL ORDER BY da_code ASC LIMIT 200",
    )
    .all() as Array<{ da_code: string }>;
  const issues = db
    .prepare(
      "SELECT DISTINCT issue_description FROM faulty_dtcs WHERE issue_description IS NOT NULL ORDER BY issue_description ASC LIMIT 50",
    )
    .all() as Array<{ issue_description: string }>;
  return {
    daCodes: daCodes.map((r) => r.da_code),
    issues: issues.map((r) => r.issue_description),
  };
}
