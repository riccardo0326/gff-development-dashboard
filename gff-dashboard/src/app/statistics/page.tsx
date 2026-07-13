"use client";

import {
  CartesianGrid,
  Cell,
  Label,
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
import { KpiCard } from "@/components/statistics/kpi-card";
import { DailyForecastAccordion } from "@/components/statistics/daily-forecast-accordion";
import { ForecastColumn } from "@/components/statistics/forecast-column";
import { InfoTooltip } from "@/components/info-tooltip";
import { SectionTitle } from "@/components/section-title";
import { Card, PageHeader, SegmentedControl } from "@/components/ui";
import type { DailyStat, PriorityStats, Settings, VehicleProjectId, WeeklyTrendPoint } from "@/lib/types";
import { VEHICLE_PROJECTS } from "@/lib/types";
import { buildDailyTrendForWeek, formatDisplayDate } from "@/lib/calculations";
import { cn, formatNumber, formatPercent, formatSlicePercent } from "@/lib/utils";

const PIE_COLORS = ["#22c55e", "#6b7280", "#f59e0b"];
const PIE_LABELS = ["Covered", "Faulty", "Pending"] as const;
const SCOPES = ["TOT", "Prio1", "Prio2", "Prio3"] as const;

const FORECAST_KPI_TOOLTIP = (
  <div className="space-y-3">
    <div>
      <p className="text-foreground font-medium">Estimated (plan rate)</p>
      <p className="mt-1">
        Uses <strong>daily estimate</strong> from Settings (target slots covered
        per working day). Days required = (pending + faulty) ÷ daily estimate
        in Total view; Feasible uses pending only.
      </p>
    </div>
    <div>
      <p className="text-foreground font-medium">End date (estimated)</p>
      <p className="mt-1">
        Today plus estimated days, counting business days only.
      </p>
    </div>
    <div>
      <p className="text-foreground font-medium">Average (actual rate)</p>
      <p className="mt-1">
        Uses the historical average of <strong>impl_for_day</strong> from daily
        entries. Days required = (pending + faulty) ÷ daily average in Total
        view; Feasible uses pending only.
      </p>
    </div>
    <div>
      <p className="text-foreground font-medium">End date (average)</p>
      <p className="mt-1">
        Today plus average-based days, counting business days only.
      </p>
    </div>
  </div>
);

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

function DonutLegend({
  items,
  total,
}: {
  items: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  const visible = items.filter((item) => item.value > 0);
  if (visible.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      {visible.map((item) => (
        <div
          key={item.label}
          className="text-foreground/70 flex items-center gap-2 text-xs"
        >
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.label}</span>
          <span className="text-muted">
            ({formatSlicePercent(item.value, total)})
          </span>
        </div>
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
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [projects, setProjects] = useState<VehicleProjectId[]>(VEHICLE_PROJECTS);

  useEffect(() => {
    fetch("/api/statistics")
      .then((res) => res.json())
      .then(setData);
  }, []);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((rows: Array<{ id: VehicleProjectId }>) => {
        if (Array.isArray(rows) && rows.length > 0) {
          setProjects(rows.map((row) => row.id));
        }
      })
      .catch(() => {
        setProjects(VEHICLE_PROJECTS);
      });
  }, []);

  const selectedRow = useMemo(
    () => data?.priorityStats.find((row) => row.label === selectedScope),
    [data, selectedScope],
  );

  const selectedFeasibleRow = useMemo(
    () => data?.priorityStatsFeasible.find((row) => row.label === selectedScope),
    [data, selectedScope],
  );

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
          const pieTotal = row.implemented + row.faulty + row.pending;
          const chartData = [
            {
              name: "Covered",
              label: `Covered (${formatSlicePercent(row.implemented, pieTotal)})`,
              value: row.implemented,
            },
            {
              name: "Faulty",
              label: `Faulty (${formatSlicePercent(row.faulty, pieTotal)})`,
              value: row.faulty,
            },
            {
              name: "Pending",
              label: `Pending (${formatSlicePercent(row.pending, pieTotal)})`,
              value: row.pending,
            },
          ].filter((slice) => slice.value > 0);
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
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={78}
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
                    <Tooltip content={<DarkChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <DonutLegend
                total={pieTotal}
                items={[
                  { label: "Covered", value: row.implemented, color: PIE_COLORS[0] },
                  { label: "Faulty", value: row.faulty, color: PIE_COLORS[1] },
                  { label: "Pending", value: row.pending, color: PIE_COLORS[2] },
                ]}
              />
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

      {selectedRow ? (
        <>
          <section>
            <SectionTitle
              title="Priority KPIs"
              description="Coverage breakdown for the selected scope."
              action={
                <SegmentedControl
                  tone="info"
                  value={selectedScope}
                  onChange={setSelectedScope}
                  options={SCOPES.map((scope) => ({
                    value: scope,
                    label: scope,
                  }))}
                />
              }
            />
            <div
              className={cn(
                "grid gap-4 sm:grid-cols-2",
                selectedScope === "TOT" ? "xl:grid-cols-5" : "xl:grid-cols-4",
              )}
            >
              <KpiCard
                label="Coverage slots"
                value={formatNumber(selectedRow.total_dtcs)}
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
              <KpiCard
                label="Faulty DTCs"
                value={formatNumber(selectedRow.faulty)}
              />
              {selectedScope === "TOT" ? (
                <KpiCard
                  label="Daily Average"
                  value={formatNumber(
                    Math.round(selectedRow.daily_average ?? 0),
                  )}
                  accent="accent"
                />
              ) : null}
            </div>
          </section>

          {selectedFeasibleRow ? (
            <section>
              <SectionTitle
                title="Forecast & progress"
                description="Side-by-side forecast using planned and actual daily rates."
                action={<InfoTooltip content={FORECAST_KPI_TOOLTIP} />}
              />
              <div className="grid gap-6 xl:grid-cols-2">
                <Card className="space-y-4">
                  <ForecastColumn
                    title="Total"
                    description="Includes all applicable coverage slots. Forecast days use pending + faulty. Progress bars show covered, pending, and faulty."
                    stats={selectedRow}
                    projects={projects}
                    includeFaultyInBar
                  />
                </Card>
                <Card className="space-y-4">
                  <ForecastColumn
                    title="Feasible"
                    description="Excludes faulty DTCs from pending and forecast. Progress bars show only covered and pending."
                    stats={selectedFeasibleRow}
                    projects={projects}
                    includeFaultyInBar={false}
                  />
                </Card>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <Card>
        <SectionTitle
          title="Daily forecast"
          description="Browse cumulative coverage progress by month and day."
        />
        <DailyForecastAccordion rows={data.forecast} />
      </Card>
    </div>
  );
}
