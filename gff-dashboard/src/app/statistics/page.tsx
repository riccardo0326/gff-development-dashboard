"use client";

import {
  CartesianGrid,
  Cell,
  Label,
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
import { X } from "lucide-react";
import { DarkChartTooltip } from "@/components/chart-tooltip";
import { ProgressBar } from "@/components/progress-bar";
import { Card, PageHeader, SegmentedControl } from "@/components/ui";
import type { DailyStat, PriorityStats, Settings, WeeklyTrendPoint } from "@/lib/types";
import { buildDailyTrendForWeek, formatDisplayDate } from "@/lib/calculations";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

const PIE_COLORS = ["#22c55e", "#6b7280", "#f59e0b"];
const PIE_LABELS = ["Covered", "Faulty", "Pending"] as const;
const SCOPES = ["TOT", "Prio1", "Prio2", "Prio3"] as const;
const KPI_MODES = ["total", "feasible"] as const;

interface StatisticsResponse {
  priorityStats: PriorityStats[];
  priorityStatsFeasible: PriorityStats[];
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
      <p className="text-foreground/80 text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint ? (
        <p className="text-foreground/60 mt-1 text-xs">{hint}</p>
      ) : null}
    </Card>
  );
}

function DonutLegend() {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs">
      {PIE_LABELS.map((label, index) => (
        <span
          key={label}
          className="text-foreground/70 inline-flex items-center gap-1.5"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: PIE_COLORS[index] }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function DonutCenterLabel({
  viewBox,
  implemented,
  total,
}: {
  viewBox?: { cx?: number; cy?: number };
  implemented: number;
  total: number;
}) {
  const cx = viewBox?.cx;
  const cy = viewBox?.cy;
  if (cx === undefined || cy === undefined) return null;
  const pct = total > 0 ? Math.round((implemented / total) * 100) : 0;

  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} y={cy - 6} fill="#e6edf3" fontSize={18} fontWeight={700}>
        {pct}%
      </tspan>
      <tspan x={cx} y={cy + 14} fill="#8b949e" fontSize={11}>
        covered
      </tspan>
    </text>
  );
}

function ChartLegend() {
  return (
    <div className="mb-3 flex flex-wrap justify-end gap-4 text-xs">
      <span className="text-muted inline-flex items-center gap-2">
        <span className="inline-block h-0.5 w-6 bg-[#3b82f6]" />
        Covered for week
      </span>
      <span className="text-muted inline-flex items-center gap-2">
        <span className="inline-block h-0.5 w-6 bg-[#22c55e]" />
        Weekly benchmark (5d avg)
      </span>
    </div>
  );
}

function WeekAxisTick({
  x,
  y,
  payload,
  onSelectWeek,
}: {
  x?: string | number;
  y?: string | number;
  payload?: { value?: string };
  onSelectWeek: (week: number) => void;
}) {
  const label = payload?.value ?? "";
  const week = Number(label.replace("Week ", ""));

  return (
    <g transform={`translate(${Number(x ?? 0)},${Number(y ?? 0)})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="middle"
        fill="#8b98a8"
        fontSize={11}
        className="cursor-pointer hover:fill-white"
        onClick={() => {
          if (Number.isFinite(week)) onSelectWeek(week);
        }}
      >
        {label}
      </text>
    </g>
  );
}

function WeekDetailModal({
  week,
  year,
  dailyStats,
  onClose,
}: {
  week: number;
  year: number;
  dailyStats: DailyStat[];
  onClose: () => void;
}) {
  const dailyTrend = useMemo(
    () => buildDailyTrendForWeek(dailyStats, year, week),
    [dailyStats, year, week],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="border-card-border bg-card max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="week-modal-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 id="week-modal-title" className="text-lg font-semibold">
              Week {week} · {year}
            </h3>
            <p className="text-muted mt-1 text-sm">
              Daily covered DTCs for this ISO week. Hover the chart to read per-day values.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground rounded-lg p-1 hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap justify-end gap-4 text-xs">
          <span className="text-muted inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 bg-[#3b82f6]" />
            Covered for day
          </span>
          <span className="text-muted inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 bg-[#22c55e]" />
            Daily average
          </span>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyTrend}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="dayLabel" stroke="#8b98a8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#8b98a8" allowDecimals={false} />
              <Tooltip content={<DarkChartTooltip />} />
              <Line
                type="monotone"
                dataKey="impl_for_day"
                name="Covered for day"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="daily_average"
                name="Daily average"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function StatisticsPage() {
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [selectedScope, setSelectedScope] =
    useState<(typeof SCOPES)[number]>("TOT");
  const [kpiMode, setKpiMode] = useState<(typeof KPI_MODES)[number]>("total");
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

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
      kpiMode === "feasible"
        ? data.priorityStatsFeasible
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

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {pieRows.map((row) => {
          const chartData = [
            {
              name: "Covered",
              label: `Covered (${formatNumber(row.implemented)})`,
              value: row.implemented,
            },
            {
              name: "Faulty",
              label: `Faulty (${formatNumber(row.faulty)})`,
              value: row.faulty,
            },
            {
              name: "Pending",
              label: `Pending (${formatNumber(row.pending)})`,
              value: row.pending,
            },
          ].filter((slice) => slice.value > 0);
          const pieTotal = row.implemented + row.faulty + row.pending;
          const displayData =
            chartData.length > 0
              ? chartData
              : [{ name: "Empty", label: "No data", value: 1 }];

          return (
            <Card key={row.label}>
              <h3 className="mb-3 font-medium">{row.label}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={displayData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={52}
                      outerRadius={78}
                      label={({ name, value, percent }) =>
                        value > 0 && name !== "Empty"
                          ? `${name} ${formatNumber(value)} (${((percent ?? 0) * 100).toFixed(0)}%)`
                          : ""
                      }
                      labelLine={false}
                    >
                      {displayData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={
                            entry.name === "Empty"
                              ? "#30363d"
                              : PIE_COLORS[
                                  PIE_LABELS.indexOf(
                                    entry.name as (typeof PIE_LABELS)[number],
                                  )
                                ] ?? PIE_COLORS[index % PIE_COLORS.length]
                          }
                        />
                      ))}
                      <Label
                        content={(props) => (
                          <DonutCenterLabel
                            viewBox={props.viewBox as { cx?: number; cy?: number }}
                            implemented={row.implemented}
                            total={pieTotal}
                          />
                        )}
                        position="center"
                      />
                    </Pie>
                    <Legend />
                    <Tooltip content={<DarkChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <DonutLegend />
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">Weekly covered DTCs</h3>
            <p className="text-muted mt-1 text-sm">
              Click a week label to open the daily breakdown.
            </p>
          </div>
          <p className="text-muted text-sm">Year {chartYear}</p>
        </div>
        <ChartLegend />
        <div className="overflow-x-auto">
          <div className="h-80 min-w-[2912px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weeklyTrend}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis
                  dataKey="weekLabel"
                  stroke="#8b98a8"
                  interval={0}
                  height={36}
                  tick={(props) => (
                    <WeekAxisTick
                      {...props}
                      onSelectWeek={setSelectedWeek}
                    />
                  )}
                />
                <YAxis stroke="#8b98a8" />
                <Tooltip content={<DarkChartTooltip />} />
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

      {selectedWeek !== null ? (
        <WeekDetailModal
          week={selectedWeek}
          year={chartYear}
          dailyStats={data.dailyStats}
          onClose={() => setSelectedWeek(null)}
        />
      ) : null}

      <Card>
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">Priority KPIs</h3>
            <p className="text-muted mt-1 text-sm">
              Select a scope to inspect coverage and forecast metrics.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SegmentedControl
              tone="info"
              value={selectedScope}
              onChange={setSelectedScope}
              options={SCOPES.map((scope) => ({ value: scope, label: scope }))}
            />
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
                      {kpiMode === "feasible"
                        ? "Excludes faulty DTCs from pending; completion counts covered work against fixable remaining slots."
                        : "Includes all applicable coverage slots."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SegmentedControl
                      tone="success"
                      value={kpiMode}
                      onChange={setKpiMode}
                      options={KPI_MODES.map((mode) => ({
                        value: mode,
                        label: mode,
                      }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    label="Days required (estimated)"
                    value={
                      selectedForecastRow.days_required_estimated != null
                        ? String(
                            Math.round(selectedForecastRow.days_required_estimated),
                          )
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
                      selectedForecastRow.days_required_average != null
                        ? String(
                            Math.round(selectedForecastRow.days_required_average),
                          )
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
                  {(["LB74x", "LB636", "LB63x"] as const).map((project) => {
                    const segments = selectedForecastRow.segments[project];
                    return (
                      <Card key={project} className="bg-background/40">
                        <p className="mb-2 text-sm font-medium">{project}</p>
                        <ProgressBar
                          value={selectedForecastRow.completion[project]}
                          segments={segments}
                        />
                        <p className="text-muted mt-2 text-xs">
                          {formatPercent(selectedForecastRow.completion[project])}{" "}
                          completion
                          {segments.faulty > 0
                            ? ` · ${formatNumber(segments.faulty)} faulty`
                            : ""}
                        </p>
                      </Card>
                    );
                  })}
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
