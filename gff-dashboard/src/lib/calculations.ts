import {
  addBusinessDays,
  addDays,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  setISOWeek,
  startOfISOWeek,
} from "date-fns";
import type {
  DailyStat,
  Ecu,
  PriorityStats,
  ProjectCompletion,
  ProjectSegments,
  Settings,
  VehicleProjectId,
  WeeklyTrendPoint,
} from "./types";
import { VEHICLE_PROJECTS } from "./types";
import { resolveCoverageSlotState, type CoverageSlotRow } from "./gff";

export interface CoverageRow extends CoverageSlotRow {}

function emptyProjectSegments(): Record<VehicleProjectId, ProjectSegments> {
  return {
    LB74x: { covered: 0, pending: 0, faulty: 0 },
    LB636: { covered: 0, pending: 0, faulty: 0 },
    LB63x: { covered: 0, pending: 0, faulty: 0 },
  };
}

export function countProjectCoverage(
  rows: CoverageRow[],
  project: VehicleProjectId,
  faultyDtcIds?: Set<number>,
): ProjectCompletion {
  let covered = 0;
  let pending = 0;
  let faulty = 0;

  for (const row of rows) {
    const state = resolveCoverageSlotState(row, project, faultyDtcIds);
    if (!state) continue;

    if (state === "faulty") faulty += 1;
    else if (state === "covered") covered += 1;
    else pending += 1;
  }

  const total = covered + pending + faulty;
  const actionable = covered + pending;
  return {
    project,
    total,
    covered,
    pending,
    faulty,
    completion_pct: actionable > 0 ? covered / actionable : 0,
  };
}

export function computeEcuProjectCompletion(
  _ecu: Ecu,
  rows: CoverageRow[],
  faultyDtcIds?: Set<number>,
): Record<VehicleProjectId, ProjectCompletion | null> {
  const result = {} as Record<VehicleProjectId, ProjectCompletion | null>;

  for (const project of VEHICLE_PROJECTS) {
    const stats = countProjectCoverage(rows, project, faultyDtcIds);
    result[project] = stats.total > 0 ? stats : null;
  }

  return result;
}

export function aggregateCoverageStats(
  ecus: Ecu[],
  allRows: Array<CoverageRow & { ecu_id: string; priority: number; dtc_id: number }>,
  priorityFilter?: number,
  options?: { faultyDtcIds?: Set<number>; excludeFaultyFromTotals?: boolean },
): {
  total_dtcs: number;
  implemented: number;
  pending: number;
  faulty: number;
  completion: Record<VehicleProjectId, number>;
  segments: Record<VehicleProjectId, ProjectSegments>;
} {
  const filteredEcus =
    priorityFilter === undefined
      ? ecus
      : ecus.filter((e) => e.priority === priorityFilter);
  const ecuIds = new Set(filteredEcus.map((e) => e.id));
  const rows = allRows.filter((r) => ecuIds.has(r.ecu_id));
  const faultyDtcIds = options?.faultyDtcIds;

  let total = 0;
  let implemented = 0;
  let pending = 0;
  let faulty = 0;
  const perProject = emptyProjectSegments();

  for (const row of rows) {
    for (const project of VEHICLE_PROJECTS) {
      const state = resolveCoverageSlotState(row, project, faultyDtcIds);
      if (!state) continue;

      if (state === "faulty") {
        faulty += 1;
        perProject[project].faulty += 1;
        if (!options?.excludeFaultyFromTotals) {
          total += 1;
        }
        continue;
      }

      total += 1;
      if (state === "covered") {
        implemented += 1;
        perProject[project].covered += 1;
      } else {
        pending += 1;
        perProject[project].pending += 1;
      }
    }
  }

  const completion = {} as Record<VehicleProjectId, number>;
  for (const project of VEHICLE_PROJECTS) {
    const { covered, pending: p } = perProject[project];
    const denom = covered + p;
    completion[project] = denom > 0 ? covered / denom : 0;
  }

  return {
    total_dtcs: total,
    implemented,
    pending,
    faulty,
    completion,
    segments: perProject,
  };
}

export function computeDailyAverage(dailyStats: DailyStat[]): number {
  if (dailyStats.length === 0) return 0;
  const sum = dailyStats.reduce((acc, row) => acc + row.impl_for_day, 0);
  return sum / dailyStats.length;
}

export function addWorkdays(from: Date, days: number): Date {
  if (days <= 0) return from;
  return addBusinessDays(from, Math.ceil(days));
}

function forecastWorkload(
  stats: { pending: number; faulty: number },
  options?: { includeFaultyInForecast?: boolean },
): number {
  return options?.includeFaultyInForecast
    ? stats.pending + stats.faulty
    : stats.pending;
}

export function buildPriorityStats(
  ecus: Ecu[],
  allRows: Array<CoverageRow & { ecu_id: string; priority: number; dtc_id: number }>,
  settings: Settings,
  dailyStats: DailyStat[],
  options?: {
    faultyDtcIds?: Set<number>;
    excludeFaultyFromTotals?: boolean;
    includeFaultyInForecast?: boolean;
  },
): PriorityStats[] {
  const dailyAverage = computeDailyAverage(dailyStats);
  const today = new Date();

  const rows: PriorityStats[] = [];
  const labels: Array<{ label: string; priority: number | null }> = [
    { label: "TOT", priority: null },
    { label: "Prio1", priority: 1 },
    { label: "Prio2", priority: 2 },
    { label: "Prio3", priority: 3 },
  ];

  let cumulativeDaysEstimated = 0;
  let cumulativeDaysAverage = 0;

  for (const { label, priority } of labels) {
    const stats = aggregateCoverageStats(
      ecus,
      allRows,
      priority ?? undefined,
      options,
    );

    let daysRequiredEstimated: number | null = null;
    let endDateEstimated: string | null = null;
    let daysRequiredAverage: number | null = null;
    let endDateAverage: string | null = null;

    if (priority !== null) {
      const remaining = forecastWorkload(stats, options);
      if (settings.daily_estimate > 0) {
        daysRequiredEstimated = remaining / settings.daily_estimate;
        cumulativeDaysEstimated += daysRequiredEstimated;
        endDateEstimated = format(
          addWorkdays(today, cumulativeDaysEstimated),
          "yyyy-MM-dd",
        );
      }
      if (dailyAverage > 0) {
        daysRequiredAverage = remaining / dailyAverage;
        cumulativeDaysAverage += daysRequiredAverage;
        endDateAverage = format(
          addWorkdays(today, cumulativeDaysAverage),
          "yyyy-MM-dd",
        );
      }
    } else {
      const remaining = forecastWorkload(stats, options);
      if (settings.daily_estimate > 0) {
        daysRequiredEstimated = remaining / settings.daily_estimate;
        endDateEstimated = format(
          addWorkdays(today, daysRequiredEstimated),
          "yyyy-MM-dd",
        );
      }
      if (dailyAverage > 0) {
        daysRequiredAverage = remaining / dailyAverage;
        endDateAverage = format(
          addWorkdays(today, daysRequiredAverage),
          "yyyy-MM-dd",
        );
      }
    }

    rows.push({
      label,
      priority,
      total_dtcs: stats.total_dtcs,
      implemented: stats.implemented,
      pending: stats.pending,
      faulty: stats.faulty,
      segments: stats.segments,
      daily_estimate: priority === null ? settings.daily_estimate : null,
      daily_average: priority === null ? dailyAverage : null,
      days_required_estimated: daysRequiredEstimated,
      end_date_estimated: endDateEstimated,
      days_required_average: daysRequiredAverage,
      end_date_average: endDateAverage,
      completion: stats.completion,
    });
  }

  return rows;
}

export function buildForecastTable(
  totalDtcs: number,
  settings: Settings,
  dailyStats: DailyStat[],
): Array<{
  stat_date: string;
  implemented_count: number;
  pending: number;
  impl_for_day: number;
  daily_average: number;
}> {
  const dailyAverage = computeDailyAverage(dailyStats);
  const sorted = [...dailyStats].sort((a, b) =>
    a.stat_date.localeCompare(b.stat_date),
  );

  if (sorted.length === 0) {
    return [];
  }

  return sorted.map((row) => ({
    stat_date: row.stat_date,
    implemented_count: row.implemented_count,
    pending: totalDtcs - row.implemented_count,
    impl_for_day: row.impl_for_day,
    daily_average: dailyAverage,
  }));
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function buildWeeklyTrend(
  dailyStats: DailyStat[],
  year: number,
): WeeklyTrendPoint[] {
  const dailyAverage = computeDailyAverage(dailyStats);
  const weeklyBenchmark = Number((dailyAverage * 5).toFixed(1));
  const weeks: WeeklyTrendPoint[] = Array.from({ length: 52 }, (_, index) => ({
    week: index + 1,
    weekLabel: `Week ${index + 1}`,
    impl_for_day: 0,
    weekly_benchmark: weeklyBenchmark,
  }));

  for (const row of dailyStats) {
    const date = parseISO(row.stat_date);
    if (getISOWeekYear(date) !== year) continue;

    const weekNum = getISOWeek(date);
    if (weekNum < 1 || weekNum > 52) continue;

    weeks[weekNum - 1].impl_for_day += row.impl_for_day;
  }

  return weeks;
}

export function buildDailyTrendForWeek(
  dailyStats: DailyStat[],
  year: number,
  week: number,
): Array<{
  stat_date: string;
  dayLabel: string;
  impl_for_day: number;
  daily_average: number;
}> {
  const dailyAverage = computeDailyAverage(dailyStats);
  const statsByDate = new Map(
    dailyStats.map((row) => [row.stat_date, row.impl_for_day]),
  );
  const weekStart = startOfISOWeek(setISOWeek(new Date(year, 0, 4), week));

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const statDate = format(date, "yyyy-MM-dd");
    return {
      stat_date: statDate,
      dayLabel: format(date, "EEE dd MMM"),
      impl_for_day: statsByDate.get(statDate) ?? 0,
      daily_average: Number(dailyAverage.toFixed(1)),
    };
  });
}

export function parseSettings(raw: Record<string, string>): Settings {
  const forecastStart = raw.forecast_start_date ?? "2026-03-26";
  const defaultYear = Number(forecastStart.slice(0, 4)) || new Date().getFullYear();

  return {
    daily_estimate: Number(raw.daily_estimate ?? 50),
    forecast_start_date: forecastStart,
    baseline_implemented: Number(raw.baseline_implemented ?? 0),
    statistics_chart_year: Number(raw.statistics_chart_year ?? defaultYear),
  };
}

export function formatDisplayDate(isoDate: string): string {
  return format(parseISO(isoDate), "dd MMM yyyy");
}
