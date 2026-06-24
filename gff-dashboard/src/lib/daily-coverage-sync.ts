import { getDb } from "./db";
import { nowSqliteDatetime } from "./datetime";
import type { DailyStat, VehicleProjectId } from "./types";
import { todayIsoDate } from "./daily-coverage";

type CoverageStatus = "pending" | "covered";

function getBaselineImplemented(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'baseline_implemented'")
    .get() as { value: string } | undefined;
  return Number(row?.value ?? 22167);
}

function getPreviousCumulative(beforeDate: string): number {
  const db = getDb();
  const previous = db
    .prepare(
      `
      SELECT implemented_count
      FROM daily_stats
      WHERE stat_date < ?
      ORDER BY stat_date DESC
      LIMIT 1
    `,
    )
    .get(beforeDate) as { implemented_count: number } | undefined;

  if (previous) return previous.implemented_count;
  return getBaselineImplemented();
}

export function countAutoCoverageForDate(statDate: string): number {
  const db = getDb();
  const covered = (
    db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM coverage_changes
        WHERE stat_date = ? AND from_status = 'pending' AND to_status = 'covered'
      `,
      )
      .get(statDate) as { count: number }
  ).count;

  const reverted = (
    db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM coverage_changes
        WHERE stat_date = ? AND from_status = 'covered' AND to_status = 'pending'
      `,
      )
      .get(statDate) as { count: number }
  ).count;

  return Math.max(0, covered - reverted);
}

export function syncDailyStatsForDate(statDate: string): DailyStat {
  const db = getDb();
  const auto = countAutoCoverageForDate(statDate);
  const existing = db
    .prepare("SELECT * FROM daily_stats WHERE stat_date = ?")
    .get(statDate) as DailyStat | undefined;
  const manual = existing?.impl_for_day_manual ?? 0;
  const implForDay = auto + manual;
  const implementedCount = getPreviousCumulative(statDate) + implForDay;

  const row = db
    .prepare(
      `
      INSERT INTO daily_stats (
        stat_date, implemented_count, impl_for_day,
        impl_for_day_auto, impl_for_day_manual
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(stat_date) DO UPDATE SET
        implemented_count = excluded.implemented_count,
        impl_for_day = excluded.impl_for_day,
        impl_for_day_auto = excluded.impl_for_day_auto,
        impl_for_day_manual = daily_stats.impl_for_day_manual
      RETURNING *
    `,
    )
    .get(
      statDate,
      implementedCount,
      implForDay,
      auto,
      manual,
    ) as DailyStat;

  return normalizeDailyStat(row);
}

export function normalizeDailyStat(row: DailyStat): DailyStat {
  const auto = row.impl_for_day_auto ?? 0;
  const manual = row.impl_for_day_manual ?? 0;
  return {
    ...row,
    impl_for_day_auto: auto,
    impl_for_day_manual: manual,
    impl_for_day: auto + manual,
  };
}

export function recordCoverageTransition(input: {
  dtcId: number;
  ecuId: string;
  project: VehicleProjectId;
  fromStatus: CoverageStatus;
  toStatus: CoverageStatus;
  statDate?: string;
  userId?: number | null;
  username?: string | null;
  troubleCode?: string | null;
  symptom?: string | null;
  changeSource?: "manual" | "bulk";
  syncDaily?: boolean;
}): { dailyStat: DailyStat | null; changeId: number } {
  const db = getDb();
  const statDate = input.statDate ?? todayIsoDate();
  const changedAt = nowSqliteDatetime();

  const result = db.prepare(
    `
    INSERT INTO coverage_changes (
      dtc_id, ecu_id, project, from_status, to_status, stat_date,
      user_id, username, trouble_code, symptom, change_source, changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    input.dtcId,
    input.ecuId,
    input.project,
    input.fromStatus,
    input.toStatus,
    statDate,
    input.userId ?? null,
    input.username ?? null,
    input.troubleCode ?? null,
    input.symptom ?? null,
    input.changeSource ?? "manual",
    changedAt,
  );

  const changeId = Number(result.lastInsertRowid);
  const dailyStat =
    input.syncDaily === false ? null : syncDailyStatsForDate(statDate);

  return { dailyStat, changeId };
}

export function addManualDailyCount(input: {
  stat_date: string;
  impl_for_day: number;
}): DailyStat {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM daily_stats WHERE stat_date = ?")
    .get(input.stat_date) as DailyStat | undefined;

  const manual = (existing?.impl_for_day_manual ?? 0) + input.impl_for_day;

  if (existing) {
    db.prepare(
      "UPDATE daily_stats SET impl_for_day_manual = ? WHERE stat_date = ?",
    ).run(manual, input.stat_date);
  } else {
    db.prepare(
      `
      INSERT INTO daily_stats (
        stat_date, implemented_count, impl_for_day,
        impl_for_day_auto, impl_for_day_manual
      ) VALUES (?, 0, 0, 0, ?)
    `,
    ).run(input.stat_date, manual);
  }

  return syncDailyStatsForDate(input.stat_date);
}

export function getTodayAutoCoverageCount(): number {
  return countAutoCoverageForDate(todayIsoDate());
}
