"use client";

import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { ProgressBar } from "@/components/progress-bar";
import { Card, PageHeader } from "@/components/ui";
import type { DailyStat, PriorityStats, Settings, WeeklyTrendPoint } from "@/lib/types";
import { formatDisplayDate } from "@/lib/calculations";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

const PIE_COLORS = ["#22c55e", "#f59e0b"];
const SCOPES = ["TOT", "Prio1", "Prio2", "Prio3"] as const;
const KPI_MODES = ["total", "feasable"] as const;

interface StatisticsResponse {
  priorityStats: PriorityStats[];
  priorityStatsFeasable: PriorityStats[];
  forecast: Array<{
    stat_date: string;
    implemented_count: number;
    pending: number;
    impl_for_day: number;
    daily_average: number;
  }>;
  weeklyTrend: WeeklyTrendPoint[];
  dailyStats: DailyStat[];
  settings: Settings;
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "success" | "warning" | "accent";
}) {
  return (
    <Card
      className={cn(
        accent === "success" && "border-success/20",
        accent === "warning" && "border-warning/20",
        accent === "accent" && "border-accent/20",
      )}
    >
      <p className="text-muted text-xs tracking-wide uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint ? <p className="text-muted mt-1 text-xs">{hint}</p> : null}
    </Card>
  );
}

export default function StatisticsPage() {
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [selectedScope, setSelectedScope] =
    useState<(typeof SCOPES)[number]>("TOT");
  const [kpiMode, setKpiMode] = useState<(typeof KPI_MODES)[number]>("total");

  useEffect(() => {
    fetch("/api/statistics")
      .then((res) => res.json())
      .then(setData);
  }, []);

  const selectedRow = useMemo(
    () => data?.priorityStats.find((row) => row.label === selectedScope),
    [data, selectedScope],
  );

  const selectedForecastRow = useMemo(() => {
    if (!data) return null;
    const stats =
      kpiMode === "feasable"
        ? data.priorityStatsFeasable
        : data.priorityStats;
    return stats.find((row) => row.label === selectedScope) ?? null;
  }, [data, selectedScope, kpiMode]);

  if (!data) {
    return (
      <div>
        <PageHeader title="Statistics" />
        <Card>
          <p className="text-muted text-sm">Loading statistics...</p>
        </Card>
      </div>
    );
  }

  const pieRows = data.priorityStats.filter((row) =>
    SCOPES.includes(row.label as (typeof SCOPES)[number]),
  );

  const chartYear = data.settings.statistics_chart_year;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statistics"
        description="Priority breakdown, completion forecasts, and weekly implementation trend."
      />

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {pieRows.map((row) => {
          const chartData = [
            {
              name: "Covered",
              label: `Covered (${formatNumber(row.implemented)})`,
              value: row.implemented,
            },
            {
              name: "Pending",
              label: `Pending (${formatNumber(row.pending)})`,
              value: row.pending,
            },
          ];
          return (
            <Card key={row.label}>
              <h3 className="mb-3 font-medium">{row.label}</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={50}
                      outerRadius={80}
                    >
                      {chartData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-medium">Weekly covered DTCs</h3>
          <p className="text-muted text-sm">Year {chartYear}</p>
        </div>
        <div className="overflow-x-auto">
          <div className="h-80 min-w-[2912px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weeklyTrend}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis
                  dataKey="weekLabel"
                  stroke="#8b98a8"
                  interval={0}
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke="#8b98a8" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="impl_for_day"
                  name="Covered for week"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="weekly_benchmark"
                  name="Weekly benchmark (5d avg)"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">Priority KPIs</h3>
            <p className="text-muted mt-1 text-sm">
              Select a scope to inspect coverage and forecast metrics.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SCOPES.map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => setSelectedScope(scope)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  selectedScope === scope
                    ? "bg-accent text-white"
                    : "border-card-border text-muted hover:text-foreground border hover:bg-white/5",
                )}
              >
                {scope}
              </button>
            ))}
          </div>
        </div>

        {selectedRow ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <KpiCard
                label="Coverage slots"
                value={formatNumber(selectedRow.total_dtcs)}
                hint="Applicable LB74x / LB636 / LB63x cells (matches Excel TOT)"
              />
              <KpiCard
                label="Covered"
                value={formatNumber(selectedRow.implemented)}
                accent="success"
              />
              <KpiCard
                label="Pending"
                value={formatNumber(selectedRow.pending)}
                accent="warning"
              />
            </div>

            {selectedRow.label === "TOT" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <KpiCard
                  label="Daily estimate"
                  value={String(selectedRow.daily_estimate ?? "—")}
                  hint="Target covered DTCs per working day"
                  accent="accent"
                />
                <KpiCard
                  label="Daily average"
                  value={
                    selectedRow.daily_average
                      ? selectedRow.daily_average.toFixed(1)
                      : "—"
                  }
                  hint="Average from manual daily entries"
                  accent="accent"
                />
              </div>
            ) : null}

            {selectedForecastRow ? (
              <Card className="border-card-border bg-background/40 space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="font-medium">Forecast &amp; progress</h4>
                    <p className="text-muted mt-1 text-sm">
                      {kpiMode === "feasable"
                        ? "Excludes faulty DTCs that cannot be covered with a GFF."
                        : "Includes all applicable coverage slots."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {KPI_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setKpiMode(mode)}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-sm capitalize transition-colors",
                          kpiMode === mode
                            ? "bg-accent text-white"
                            : "border-card-border text-muted hover:text-foreground border hover:bg-white/5",
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    label="Days required (estimated)"
                    value={
                      selectedForecastRow.days_required_estimated
                        ? selectedForecastRow.days_required_estimated.toFixed(1)
                        : "—"
                    }
                  />
                  <KpiCard
                    label="End date (estimated)"
                    value={
                      selectedForecastRow.end_date_estimated
                        ? formatDisplayDate(selectedForecastRow.end_date_estimated)
                        : "—"
                    }
                  />
                  <KpiCard
                    label="Days required (average)"
                    value={
                      selectedForecastRow.days_required_average
                        ? selectedForecastRow.days_required_average.toFixed(1)
                        : "—"
                    }
                  />
                  <KpiCard
                    label="End date (average)"
                    value={
                      selectedForecastRow.end_date_average
                        ? formatDisplayDate(selectedForecastRow.end_date_average)
                        : "—"
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {(["LB74x", "LB636", "LB63x"] as const).map((project) => (
                    <Card key={project} className="bg-background/40">
                      <p className="mb-2 text-sm font-medium">{project}</p>
                      <ProgressBar value={selectedForecastRow.completion[project]} />
                      <p className="text-muted mt-2 text-xs">
                        {formatPercent(selectedForecastRow.completion[project])}{" "}
                        completion
                      </p>
                    </Card>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="overflow-x-auto">
        <h3 className="mb-4 font-medium">Daily forecast table</h3>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-muted border-card-border border-b text-left">
              <th className="min-w-[140px] px-3 py-2">Date</th>
              <th className="min-w-[140px] px-3 py-2">Covered total</th>
              <th className="min-w-[140px] px-3 py-2">Pending</th>
              <th className="min-w-[140px] px-3 py-2">Covered for day</th>
            </tr>
          </thead>
          <tbody>
            {data.forecast.map((row) => (
              <tr
                key={row.stat_date}
                className="border-card-border border-b last:border-b-0"
              >
                <td className="px-3 py-2">
                  {formatDisplayDate(row.stat_date)}
                </td>
                <td className="px-3 py-2">
                  {formatNumber(row.implemented_count)}
                </td>
                <td className="px-3 py-2">{formatNumber(row.pending)}</td>
                <td className="px-3 py-2">{formatNumber(row.impl_for_day)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
