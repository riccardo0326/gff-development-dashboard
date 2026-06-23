import { addBusinessDays, format, parseISO } from "date-fns";
import type {
  DailyStat,
  Ecu,
  PriorityStats,
  ProjectCompletion,
  Settings,
  VehicleProjectId,
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

export interface CoverageRow {
  coverage_lb74x: string | null;
  coverage_lb636: string | null;
  coverage_lb63x: string | null;
  applicable_lb74x?: number;
  applicable_lb636?: number;
  applicable_lb63x?: number;
}

const SLOT_APPLICABLE_COLUMNS: Record<
  VehicleProjectId,
  "applicable_lb74x" | "applicable_lb636" | "applicable_lb63x"
> = {
  LB74x: "applicable_lb74x",
  LB636: "applicable_lb636",
  LB63x: "applicable_lb63x",
};

export function countProjectCoverage(
  rows: CoverageRow[],
  project: VehicleProjectId,
): ProjectCompletion {
  const column = PROJECT_COLUMNS[project];
  const applicableColumn = SLOT_APPLICABLE_COLUMNS[project];
  let covered = 0;
  let pending = 0;
  let neutral = 0;

  for (const row of rows) {
    const applicable = row[applicableColumn] ?? (row[column] ? 1 : 0);
    if (!applicable) continue;

    const value = row[column];
    if (value === "covered") covered += 1;
    else if (value === "pending") pending += 1;
    else neutral += 1;
  }

  const total = covered + pending + neutral;
  return {
    project,
    total,
    covered,
    pending,
    completion_pct: total > 0 ? covered / total : 0,
  };
}

export function computeEcuProjectCompletion(
  _ecu: Ecu,
  rows: CoverageRow[],
): Record<VehicleProjectId, ProjectCompletion | null> {
  const result = {} as Record<VehicleProjectId, ProjectCompletion | null>;

  for (const project of VEHICLE_PROJECTS) {
    const stats = countProjectCoverage(rows, project);
    result[project] = stats.total > 0 ? stats : null;
  }

  return result;
}

export function aggregateCoverageStats(
  ecus: Ecu[],
  allRows: Array<CoverageRow & { ecu_id: string; priority: number }>,
  priorityFilter?: number,
): {
  total_dtcs: number;
  implemented: number;
  pending: number;
  completion: Record<VehicleProjectId, number>;
} {
  const filteredEcus =
    priorityFilter === undefined
      ? ecus
      : ecus.filter((e) => e.priority === priorityFilter);
  const ecuIds = new Set(filteredEcus.map((e) => e.id));
  const rows = allRows.filter((r) => ecuIds.has(r.ecu_id));

  let total = 0;
  let implemented = 0;
  let pending = 0;
  const perProject: Record<
    VehicleProjectId,
    { covered: number; pending: number; neutral: number }
  > = {
    LB74x: { covered: 0, pending: 0, neutral: 0 },
    LB636: { covered: 0, pending: 0, neutral: 0 },
    LB63x: { covered: 0, pending: 0, neutral: 0 },
  };

  for (const row of rows) {
    for (const project of VEHICLE_PROJECTS) {
      const applicable =
        row[SLOT_APPLICABLE_COLUMNS[project]] ??
        (row[PROJECT_COLUMNS[project]] ? 1 : 0);
      if (!applicable) continue;

      const value = row[PROJECT_COLUMNS[project]];
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
    }
  }

  const completion = {} as Record<VehicleProjectId, number>;
  for (const project of VEHICLE_PROJECTS) {
    const { covered, pending: p, neutral } = perProject[project];
    const denom = covered + p + neutral;
    completion[project] = denom > 0 ? covered / denom : 0;
  }

  return { total_dtcs: total, implemented, pending, completion };
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
  allRows: Array<CoverageRow & { ecu_id: string; priority: number }>,
  settings: Settings,
  dailyStats: DailyStat[],
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
    const stats = aggregateCoverageStats(ecus, allRows, priority ?? undefined);

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

export function parseSettings(raw: Record<string, string>): Settings {
  return {
    daily_estimate: Number(raw.daily_estimate ?? 50),
    forecast_start_date: raw.forecast_start_date ?? "2026-03-26",
    baseline_implemented: Number(raw.baseline_implemented ?? 0),
  };
}

export function formatDisplayDate(isoDate: string): string {
  return format(parseISO(isoDate), "dd MMM yyyy");
}
