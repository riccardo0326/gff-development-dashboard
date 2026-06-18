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
import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import type { DailyStat, PriorityStats } from "@/lib/types";
import { formatDisplayDate } from "@/lib/calculations";
import { formatNumber, formatPercent } from "@/lib/utils";

const PIE_COLORS = ["#22c55e", "#f59e0b"];

interface StatisticsResponse {
  priorityStats: PriorityStats[];
  forecast: Array<{
    stat_date: string;
    implemented_count: number;
    pending: number;
    impl_for_day: number;
    daily_average: number;
  }>;
  dailyStats: DailyStat[];
}

export default function StatisticsPage() {
  const [data, setData] = useState<StatisticsResponse | null>(null);

  useEffect(() => {
    fetch("/api/statistics")
      .then((res) => res.json())
      .then(setData);
  }, []);

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
    ["TOT", "Prio1", "Prio2", "Prio3"].includes(row.label),
  );

  const trendData = data.forecast.map((row) => ({
    date: row.stat_date.slice(5),
    impl_for_day: row.impl_for_day,
    daily_average: Number(row.daily_average.toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statistics"
        description="Priority breakdown, completion forecasts, and daily implementation trend."
      />

      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-muted border-card-border border-b text-left">
              <th className="px-2 py-2">Scope</th>
              <th className="px-2 py-2">DTCs</th>
              <th className="px-2 py-2">Covered</th>
              <th className="px-2 py-2">Pending</th>
              <th className="px-2 py-2">Daily est.</th>
              <th className="px-2 py-2">Daily avg.</th>
              <th className="px-2 py-2">Days (est.)</th>
              <th className="px-2 py-2">End date (est.)</th>
              <th className="px-2 py-2">Days (avg.)</th>
              <th className="px-2 py-2">End date (avg.)</th>
              <th className="px-2 py-2">LB74x</th>
              <th className="px-2 py-2">LB636</th>
              <th className="px-2 py-2">LB63x</th>
            </tr>
          </thead>
          <tbody>
            {data.priorityStats.map((row) => (
              <tr key={row.label} className="border-card-border border-b last:border-b-0">
                <td className="px-2 py-3 font-medium">{row.label}</td>
                <td className="px-2 py-3">{formatNumber(row.total_dtcs)}</td>
                <td className="px-2 py-3">{formatNumber(row.implemented)}</td>
                <td className="px-2 py-3">{formatNumber(row.pending)}</td>
                <td className="px-2 py-3">
                  {row.daily_estimate ?? "—"}
                </td>
                <td className="px-2 py-3">
                  {row.daily_average ? row.daily_average.toFixed(1) : "—"}
                </td>
                <td className="px-2 py-3">
                  {row.days_required_estimated
                    ? row.days_required_estimated.toFixed(1)
                    : "—"}
                </td>
                <td className="px-2 py-3">
                  {row.end_date_estimated
                    ? formatDisplayDate(row.end_date_estimated)
                    : "—"}
                </td>
                <td className="px-2 py-3">
                  {row.days_required_average
                    ? row.days_required_average.toFixed(1)
                    : "—"}
                </td>
                <td className="px-2 py-3">
                  {row.end_date_average
                    ? formatDisplayDate(row.end_date_average)
                    : "—"}
                </td>
                <td className="px-2 py-3">{formatPercent(row.completion.LB74x)}</td>
                <td className="px-2 py-3">{formatPercent(row.completion.LB636)}</td>
                <td className="px-2 py-3">{formatPercent(row.completion.LB63x)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {pieRows.map((row) => {
          const chartData = [
            { name: "Covered", value: row.implemented },
            { name: "Pending", value: row.pending },
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
                      nameKey="name"
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
        <h3 className="mb-4 font-medium">Daily covered DTCs</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#8b98a8" />
              <YAxis stroke="#8b98a8" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="impl_for_day"
                name="Covered for day"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
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
      </Card>

      <Card className="overflow-x-auto">
        <h3 className="mb-4 font-medium">Daily forecast table</h3>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-muted border-card-border border-b text-left">
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Covered total</th>
              <th className="px-2 py-2">Pending</th>
              <th className="px-2 py-2">Covered for day</th>
              <th className="px-2 py-2">Daily average</th>
            </tr>
          </thead>
          <tbody>
            {data.forecast.map((row) => (
              <tr key={row.stat_date} className="border-card-border border-b last:border-b-0">
                <td className="px-2 py-2">{formatDisplayDate(row.stat_date)}</td>
                <td className="px-2 py-2">{formatNumber(row.implemented_count)}</td>
                <td className="px-2 py-2">{formatNumber(row.pending)}</td>
                <td className="px-2 py-2">{formatNumber(row.impl_for_day)}</td>
                <td className="px-2 py-2">{row.daily_average.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
