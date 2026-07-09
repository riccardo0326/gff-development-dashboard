import { getDb } from "./db";
import {
  addManualDailyCount,
  normalizeDailyStat,
  recordCoverageTransition,
  syncDailyStatsForDate,
} from "./daily-coverage-sync";
import { isTrackableTransition, todayIsoDate } from "./daily-coverage";
import { logAuditEvent, type AuditUser } from "./audit";
import {
  buildForecastTable,
  buildPriorityStats,
  buildWeeklyTrend,
  computeEcuProjectCompletion,
  parseSettings,
} from "./calculations";
import { compareEcuCodeHex } from "./utils";
import { hasGffAvailable } from "./gff";
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
  if (partial.statistics_chart_year !== undefined) {
    insert.run("statistics_chart_year", String(partial.statistics_chart_year));
  }

  return getSettings();
}

export interface VehicleProject {
  id: VehicleProjectId;
  name: string;
  sort_order: number;
}

export function getVehicleProjects(): VehicleProject[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT id, name, sort_order FROM vehicle_projects ORDER BY sort_order ASC",
    )
    .all() as VehicleProject[];
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

  query += " ORDER BY priority ASC";
  const rows = db.prepare(query).all(...params) as Ecu[];
  rows.sort((a, b) => a.priority - b.priority || compareEcuCodeHex(a.code, b.code));
  return rows;
}

export function getEcuCount(): number {
  const db = getDb();
  return (db.prepare("SELECT COUNT(*) as c FROM ecus").get() as { c: number }).c;
}

export function getEcuById(id: string): Ecu | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM ecus WHERE id = ?").get(id) as Ecu) ?? null;
}

export function updateEcuPriority(id: string, priority: number): Ecu | null {
  if (priority < 1 || priority > 3) {
    throw new Error("Priority must be between 1 and 3");
  }
  const db = getDb();
  const result = db.prepare("UPDATE ecus SET priority = ? WHERE id = ?").run(
    priority,
    id,
  );
  if (result.changes === 0) return null;
  return getEcuById(id);
}

export function getEcuCompletions(filters?: {
  priority?: number;
  search?: string;
}): EcuCompletion[] {
  const ecus = getEcus(filters);
  const db = getDb();
  const faultyDtcIds = getFaultyDtcIds();

  const stmt = db.prepare(`
    SELECT id as dtc_id, coverage_lb74x, coverage_lb636, coverage_lb63x,
           applicable_lb74x, applicable_lb636, applicable_lb63x,
           gff_available
    FROM dtcs WHERE ecu_id = ?
  `);

  return ecus.map((ecu) => ({
    ...ecu,
    projects: computeEcuProjectCompletion(
      ecu,
      stmt.all(ecu.id) as Array<{
        dtc_id: number;
        coverage_lb74x: string | null;
        coverage_lb636: string | null;
        coverage_lb63x: string | null;
        applicable_lb74x: number;
        applicable_lb636: number;
        applicable_lb63x: number;
        gff_available: string | null;
      }>,
      faultyDtcIds,
    ),
  }));
}

export function getAllCoverageRows() {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT d.id as dtc_id, d.coverage_lb74x, d.coverage_lb636, d.coverage_lb63x,
             d.applicable_lb74x, d.applicable_lb636, d.applicable_lb63x,
             d.gff_available, d.ecu_id, e.priority
      FROM dtcs d
      JOIN ecus e ON e.id = d.ecu_id
    `,
    )
    .all() as Array<{
    dtc_id: number;
    coverage_lb74x: string | null;
    coverage_lb636: string | null;
    coverage_lb63x: string | null;
    applicable_lb74x: number;
    applicable_lb636: number;
    applicable_lb63x: number;
    gff_available: string | null;
    ecu_id: string;
    priority: number;
  }>;
}

export function getFaultyDtcIds(): Set<number> {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT DISTINCT d.id as dtc_id
      FROM faulty_dtcs f
      LEFT JOIN ecus e ON e.code = REPLACE(UPPER(COALESCE(f.da_code, '')), 'DA', '')
        OR e.id = UPPER(COALESCE(f.da_code, ''))
      JOIN dtcs d ON d.ecu_id = e.id AND d.trouble_code = f.trouble_code
    `,
    )
    .all() as Array<{ dtc_id: number }>;

  return new Set(rows.map((row) => row.dtc_id));
}

export function getStatisticsSummary() {
  const ecus = getEcus();
  const rows = getAllCoverageRows();
  const settings = getSettings();
  const dailyStats = getDailyStats();
  const faultyDtcIds = getFaultyDtcIds();
  const priorityStats = buildPriorityStats(ecus, rows, settings, dailyStats, {
    faultyDtcIds,
    includeFaultyInForecast: true,
  });
  const priorityStatsFeasible = buildPriorityStats(ecus, rows, settings, dailyStats, {
    faultyDtcIds,
    excludeFaultyFromTotals: true,
  });
  const totalRow = priorityStats.find((r) => r.label === "TOT");
  const forecast = buildForecastTable(
    totalRow?.total_dtcs ?? 0,
    settings,
    dailyStats,
  );
  const weeklyTrend = buildWeeklyTrend(dailyStats, settings.statistics_chart_year);

  return {
    priorityStats,
    priorityStatsFeasible,
    forecast,
    weeklyTrend,
    settings,
    dailyStats,
  };
}

export function getDailyStats(): DailyStat[] {
  const db = getDb();
  return (
    db
      .prepare("SELECT * FROM daily_stats ORDER BY stat_date ASC")
      .all() as DailyStat[]
  ).map(normalizeDailyStat);
}

export function addDailyStat(input: {
  stat_date: string;
  impl_for_day: number;
}): DailyStat {
  return addManualDailyCount(input);
}

const PROJECT_COLUMN: Record<
  VehicleProjectId,
  "coverage_lb74x" | "coverage_lb636" | "coverage_lb63x"
> = {
  LB74x: "coverage_lb74x",
  LB636: "coverage_lb636",
  LB63x: "coverage_lb63x",
};

const APPLICABLE_COLUMN: Record<
  VehicleProjectId,
  "applicable_lb74x" | "applicable_lb636" | "applicable_lb63x"
> = {
  LB74x: "applicable_lb74x",
  LB636: "applicable_lb636",
  LB63x: "applicable_lb63x",
};

function resolveProjectFilters(filters?: {
  project?: VehicleProjectId;
  projects?: VehicleProjectId[];
}): VehicleProjectId[] {
  if (filters?.projects?.length) return filters.projects;
  if (filters?.project) return [filters.project];
  return [];
}

function appendCoverageProjectFilter(
  query: string,
  params: Array<string | number>,
  columnPrefix: string,
  projects: VehicleProjectId[],
  coverage: "pending" | "covered",
): { query: string; params: Array<string | number> } {
  const clauses = projects.map(
    (project) => `${columnPrefix}${PROJECT_COLUMN[project]} = ?`,
  );
  return {
    query: `${query} AND (${clauses.join(" OR ")})`,
    params: [...params, ...projects.map(() => coverage)],
  };
}

export function getDtcsForEcu(
  ecuId: string,
  filters?: {
    search?: string;
    category?: number;
    coverage?: "pending" | "covered";
    project?: VehicleProjectId;
    projects?: VehicleProjectId[];
  },
  pagination?: { page: number; pageSize: number },
) {
  const db = getDb();
  let query = "SELECT * FROM dtcs WHERE ecu_id = ?";
  let params: Array<string | number> = [ecuId];
  const projects = resolveProjectFilters(filters);

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

  if (projects.length > 0 && filters?.coverage) {
    ({ query, params } = appendCoverageProjectFilter(
      query,
      params,
      "",
      projects,
      filters.coverage,
    ));
  } else if (filters?.project && filters?.coverage) {
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
  auditUser?: AuditUser,
): { dtc: Dtc; dailyStat: DailyStat | null } | null {
  const db = getDb();
  const column = PROJECT_COLUMN[project];
  const existing = db
    .prepare("SELECT * FROM dtcs WHERE id = ?")
    .get(dtcId) as Dtc | undefined;
  if (!existing) return null;

  const currentValue = existing[column];
  if (status === null && currentValue === null) {
    return { dtc: existing, dailyStat: null };
  }
  if (status === currentValue) {
    return { dtc: existing, dailyStat: null };
  }

  db.prepare(`UPDATE dtcs SET ${column} = ? WHERE id = ?`).run(status, dtcId);
  const updated = db
    .prepare("SELECT * FROM dtcs WHERE id = ?")
    .get(dtcId) as Dtc;

  let dailyStat: DailyStat | null = null;
  if (
    isTrackableTransition(currentValue, status) &&
    (status === "pending" || status === "covered") &&
    (currentValue === "pending" || currentValue === "covered")
  ) {
    const { dailyStat: transitionStat } = recordCoverageTransition({
      dtcId,
      ecuId: existing.ecu_id,
      project,
      fromStatus: currentValue,
      toStatus: status,
      userId: auditUser?.userId ?? null,
      username: auditUser?.username ?? null,
      troubleCode: existing.trouble_code,
      symptom: existing.symptom,
      changeSource: "manual",
    });
    dailyStat = transitionStat;
  }

  return { dtc: updated, dailyStat };
}

export function updateDtcDetails(
  dtcId: number,
  input: {
    gff_available?: boolean;
    gff_program?: string | null;
    coverageUpdates?: Array<{
      project: VehicleProjectId;
      status: "pending" | "covered";
    }>;
  },
  auditUser?: AuditUser,
): { dtc: Dtc; dailyStat: DailyStat | null } | null {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM dtcs WHERE id = ?")
    .get(dtcId) as Dtc | undefined;
  if (!existing) return null;

  if (input.gff_available !== undefined) {
    db.prepare("UPDATE dtcs SET gff_available = ? WHERE id = ?").run(
      input.gff_available ? "y" : null,
      dtcId,
    );
  }
  if (input.gff_program !== undefined) {
    db.prepare("UPDATE dtcs SET gff_program = ? WHERE id = ?").run(
      input.gff_program,
      dtcId,
    );
  }

  let dailyStat: DailyStat | null = null;
  for (const update of input.coverageUpdates ?? []) {
    const result = updateDtcCoverage(
      dtcId,
      update.project,
      update.status,
      auditUser,
    );
    if (result?.dailyStat) dailyStat = result.dailyStat;
  }

  const updated = db
    .prepare("SELECT * FROM dtcs WHERE id = ?")
    .get(dtcId) as Dtc;

  return { dtc: updated, dailyStat };
}

export interface DtcSearchRow extends Dtc {
  ecu_code: string;
  ecu_priority: number;
}

export function searchDtcs(filters?: {
  search?: string;
  ecuId?: string;
  category?: number;
  coverage?: "pending" | "covered";
  project?: VehicleProjectId;
  projects?: VehicleProjectId[];
  priority?: number;
  page?: number;
  pageSize?: number;
}) {
  const db = getDb();
  let query = `
    SELECT d.*, e.code as ecu_code, e.priority as ecu_priority
    FROM dtcs d
    JOIN ecus e ON e.id = d.ecu_id
    WHERE 1=1
  `;
  let params: Array<string | number> = [];
  const projects = resolveProjectFilters(filters);

  if (filters?.search) {
    query += ` AND (
      d.symptom LIKE ? OR d.trouble_code LIKE ? OR d.dtc_text LIKE ?
      OR d.gff_program LIKE ? OR CAST(d.category AS TEXT) LIKE ?
      OR e.code LIKE ?
    )`;
    const term = `%${filters.search}%`;
    params.push(term, term, term, term, term, term);
  }

  if (filters?.ecuId) {
    query += " AND d.ecu_id = ?";
    params.push(filters.ecuId);
  }

  if (filters?.category !== undefined) {
    query += " AND d.category = ?";
    params.push(filters.category);
  }

  if (filters?.priority !== undefined) {
    query += " AND e.priority = ?";
    params.push(filters.priority);
  }

  if (projects.length > 0 && filters?.coverage) {
    ({ query, params } = appendCoverageProjectFilter(
      query,
      params,
      "d.",
      projects,
      filters.coverage,
    ));
  } else if (filters?.project && filters?.coverage) {
    query += ` AND d.${PROJECT_COLUMN[filters.project]} = ?`;
    params.push(filters.coverage);
  } else if (filters?.coverage) {
    query +=
      " AND (d.coverage_lb74x = ? OR d.coverage_lb636 = ? OR d.coverage_lb63x = ?)";
    params.push(filters.coverage, filters.coverage, filters.coverage);
  }

  const countQuery = query.replace(
    "SELECT d.*, e.code as ecu_code, e.priority as ecu_priority",
    "SELECT COUNT(*) as count",
  );
  const total = (
    db.prepare(countQuery).get(...params) as { count: number }
  ).count;

  query += " ORDER BY e.priority ASC, e.code ASC, d.id ASC";

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  query += " LIMIT ? OFFSET ?";
  params.push(pageSize, (page - 1) * pageSize);

  const items = db.prepare(query).all(...params) as DtcSearchRow[];
  return { items, total, page, pageSize };
}

export interface BulkUpdateItem {
  dtcId: number;
  project: VehicleProjectId;
  status: "pending" | "covered";
}

export function bulkUpdateDtcCoverage(
  items: BulkUpdateItem[],
  auditUser?: AuditUser,
  meta?: { source?: string; filters?: Record<string, unknown> },
): {
  updated: number;
  skipped: number;
  dailyStat: DailyStat | null;
} {
  const db = getDb();
  const statDate = todayIsoDate();
  let updated = 0;
  let skipped = 0;
  const ecuIds = new Set<string>();
  const projectCounts: Record<string, number> = {};
  let toCovered = 0;
  let toPending = 0;
  const changeIds: number[] = [];

  const updateStmt = db.prepare("SELECT * FROM dtcs WHERE id = ?");

  const applyBulk = db.transaction(() => {
    for (const item of items) {
      const existing = updateStmt.get(item.dtcId) as Dtc | undefined;
      if (!existing) {
        skipped += 1;
        continue;
      }

      const column = PROJECT_COLUMN[item.project];
      const applicableColumn = APPLICABLE_COLUMN[item.project];
      const currentValue = existing[column];
      const isApplicable = !!existing[applicableColumn];
      if (!isApplicable || currentValue === item.status) {
        skipped += 1;
        continue;
      }

      db.prepare(`UPDATE dtcs SET ${column} = ? WHERE id = ?`).run(
        item.status,
        item.dtcId,
      );

      if (
        isTrackableTransition(currentValue, item.status) &&
        (currentValue === "pending" || currentValue === "covered")
      ) {
        const { changeId } = recordCoverageTransition({
          dtcId: item.dtcId,
          ecuId: existing.ecu_id,
          project: item.project,
          fromStatus: currentValue,
          toStatus: item.status,
          statDate,
          userId: auditUser?.userId ?? null,
          username: auditUser?.username ?? null,
          troubleCode: existing.trouble_code,
          symptom: existing.symptom,
          changeSource: "bulk",
          syncDaily: false,
        });
        changeIds.push(changeId);
        ecuIds.add(existing.ecu_id);
        projectCounts[item.project] = (projectCounts[item.project] ?? 0) + 1;
        if (item.status === "covered") toCovered += 1;
        else toPending += 1;
      }

      updated += 1;
    }
  });

  applyBulk();

  let dailyStat: DailyStat | null = null;
  if (updated > 0) {
    dailyStat = syncDailyStatsForDate(statDate);

    const projectSummary = Object.entries(projectCounts)
      .map(([p, c]) => `${p}: ${c}`)
      .join(", ");

    logAuditEvent({
      eventType: "bulk_update",
      summary: `Bulk update: ${updated} coverage change(s) across ${ecuIds.size} ECU(s)`,
      user: auditUser,
      details: {
        updated,
        skipped,
        ecuCount: ecuIds.size,
        toCovered,
        toPending,
        projects: projectCounts,
        projectSummary,
        changeIds,
        source: meta?.source ?? "manual_selection",
        filters: meta?.filters ?? null,
      },
    });
  }

  return { updated, skipped, dailyStat };
}

export function getFaultyDtcs(filters?: {
  search?: string;
  da_code?: string;
  issue?: string;
  page?: number;
  pageSize?: number;
}) {
  const db = getDb();
  let query = `
    SELECT f.*,
      d.id as matched_dtc_id,
      d.gff_available,
      d.gff_program,
      d.error_handling,
      d.error_setting_conditions,
      d.coverage_lb74x,
      d.coverage_lb636,
      d.coverage_lb63x,
      d.applicable_lb74x,
      d.applicable_lb636,
      d.applicable_lb63x,
      e.code as ecu_code
    FROM faulty_dtcs f
    LEFT JOIN ecus e ON e.code = REPLACE(UPPER(COALESCE(f.da_code, '')), 'DA', '')
      OR e.id = UPPER(COALESCE(f.da_code, ''))
    LEFT JOIN dtcs d ON d.ecu_id = e.id AND d.trouble_code = f.trouble_code
    WHERE 1=1
  `;
  const params: Array<string | number> = [];

  if (filters?.search) {
    query += ` AND (
      f.symptom LIKE ? OR f.trouble_code LIKE ? OR f.dtc_text LIKE ?
      OR f.issue_description LIKE ? OR f.ev_name LIKE ?
    )`;
    const term = `%${filters.search}%`;
    params.push(term, term, term, term, term);
  }
  if (filters?.da_code) {
    query += " AND f.da_code LIKE ?";
    params.push(`%${filters.da_code}%`);
  }
  if (filters?.issue) {
    query += " AND f.issue_description LIKE ?";
    params.push(`%${filters.issue}%`);
  }

  const whereClause = query.split("WHERE 1=1")[1] ?? "";
  const countQuery = `
    SELECT COUNT(DISTINCT f.id) as count
    FROM faulty_dtcs f
    WHERE 1=1
    ${whereClause}
  `;
  const total = (
    db.prepare(countQuery).get(...params) as { count: number }
  ).count;

  query += " ORDER BY f.id ASC";
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  query += " LIMIT ? OFFSET ?";
  params.push(pageSize, (page - 1) * pageSize);

  const items = (db.prepare(query).all(...params) as FaultyDtc[]).map(
    (row) => ({
      ...row,
      counts_as_faulty:
        row.matched_dtc_id != null && !hasGffAvailable(row.gff_available),
    }),
  );
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
