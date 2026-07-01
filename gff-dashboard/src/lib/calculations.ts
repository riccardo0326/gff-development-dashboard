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

const PROJECT_COLUMNS: Record<
  VehicleProjectId,
  "coverage_lb74x" | "coverage_lb636" | "coverage_lb63x"
> = {
  LB74x: "coverage_lb74x",
  LB636: "coverage_lb636",
  LB63x: "coverage_lb63x",
};

const SLOT_APPLICABLE_COLUMNS: Record<
  VehicleProjectId,
  "applicable_lb74x" | "applicable_lb636" | "applicable_lb63x"
> = {
  LB74x: "applicable_lb74x",
  LB636: "applicable_lb636",
  LB63x: "applicable_lb63x",
};

export interface CoverageRow {
  coverage_lb74x: string | null;
  coverage_lb636: string | null;
  coverage_lb63x: string | null;
  applicable_lb74x?: number;
  applicable_lb636?: number;
  applicable_lb63x?: number;
  dtc_id?: number;
}

function emptyProjectSegments(): Record<VehicleProjectId, ProjectSegments> {
  return {
    LB74x: { covered: 0, pending: 0, neutral: 0, faulty: 0 },
    LB636: { covered: 0, pending: 0, neutral: 0, faulty: 0 },
    LB63x: { covered: 0, pending: 0, neutral: 0, faulty: 0 },
  };
}

export function countProjectCoverage(
  rows: CoverageRow[],
  project: VehicleProjectId,
  faultyDtcIds?: Set<number>,
): ProjectCompletion {
  const column = PROJECT_COLUMNS[project];
  const applicableColumn = SLOT_APPLICABLE_COLUMNS[project];
  let covered = 0;
  let pending = 0;
  let neutral = 0;
  let faulty = 0;

  for (const row of rows) {
    const applicable = row[applicableColumn] ?? (row[column] ? 1 : 0);
    if (!applicable) continue;

    if (row.dtc_id !== undefined && faultyDtcIds?.has(row.dtc_id)) {
      faulty += 1;
      continue;
    }

    const value = row[column];
    if (value === "covered") covered += 1;
    else if (value === "pending") pending += 1;
    else neutral += 1;
  }

  const total = covered + pending + neutral + faulty;
  const actionable = covered + pending + neutral;
  return {
    project,
    total,
    covered,
    pending,
    neutral,
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

  const feasibleCompletion = emptyProjectSegments();

  for (const row of rows) {
    const isFaulty = faultyDtcIds?.has(row.dtc_id) ?? false;

    for (const project of VEHICLE_PROJECTS) {
      const applicable =
        row[SLOT_APPLICABLE_COLUMNS[project]] ??
        (row[PROJECT_COLUMNS[project]] ? 1 : 0);
      if (!applicable) continue;

      const value = row[PROJECT_COLUMNS[project]];

      if (isFaulty) {
        perProject[project].faulty += 1;
        faulty += 1;

        if (options?.excludeFaultyFromTotals) {
          continue;
        }

        total += 1;
        if (value === "covered") {
          implemented += 1;
        } else if (value === "pending") {
          pending += 1;
        }
        continue;
      }

      total += 1;
      if (value === "covered") {
        implemented += 1;
        perProject[project].covered += 1;
      } else if (value === "pending") {
        pending += 1;
        perProject[project].pending += 1;
      } else {
        perProject[project].neutral += 1;
      }

      if (options?.excludeFaultyFromTotals) {
        if (value === "covered") {
          feasibleCompletion[project].covered += 1;
        } else if (value === "pending") {
          feasibleCompletion[project].pending += 1;
        } else {
          feasibleCompletion[project].neutral += 1;
        }
      }
    }
  }

  const completion = {} as Record<VehicleProjectId, number>;
  for (const project of VEHICLE_PROJECTS) {
    if (options?.excludeFaultyFromTotals) {
      const { covered, pending: p, neutral } = feasibleCompletion[project];
      const denom = covered + p + neutral;
      completion[project] = denom > 0 ? covered / denom : 0;
    } else {
      const { covered, pending: p, neutral } = perProject[project];
      const denom = covered + p + neutral;
      completion[project] = denom > 0 ? covered / denom : 0;
    }
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

export function buildPriorityStats(
  ecus: Ecu[],
  allRows: Array<CoverageRow & { ecu_id: string; priority: number; dtc_id: number }>,
  settings: Settings,
  dailyStats: DailyStat[],
  options?: { faultyDtcIds?: Set<number>; excludeFaultyFromTotals?: boolean },
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
      if (settings.daily_estimate > 0) {
        daysRequiredEstimated = stats.pending / settings.daily_estimate;
        cumulativeDaysEstimated += daysRequiredEstimated;
        endDateEstimated = format(
          addWorkdays(today, cumulativeDaysEstimated),
          "yyyy-MM-dd",
        );
      }
      if (dailyAverage > 0) {
        daysRequiredAverage = stats.pending / dailyAverage;
        cumulativeDaysAverage += daysRequiredAverage;
        endDateAverage = format(
          addWorkdays(today, cumulativeDaysAverage),
          "yyyy-MM-dd",
        );
      }
    } else {
      if (settings.daily_estimate > 0) {
        daysRequiredEstimated = stats.pending / settings.daily_estimate;
        endDateEstimated = format(
          addWorkdays(today, daysRequiredEstimated),
          "yyyy-MM-dd",
        );
      }
      if (dailyAverage > 0) {
        daysRequiredAverage = stats.pending / dailyAverage;
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
