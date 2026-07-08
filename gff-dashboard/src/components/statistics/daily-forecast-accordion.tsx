"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatDisplayDate } from "@/lib/calculations";
import { cn, formatNumber } from "@/lib/utils";

export interface ForecastDayRow {
  stat_date: string;
  implemented_count: number;
  pending: number;
  impl_for_day: number;
  daily_average: number;
}

export interface ForecastMonthGroup {
  key: string;
  label: string;
  days: ForecastDayRow[];
  totalImplForDay: number;
}

export function groupForecastByMonth(rows: ForecastDayRow[]): ForecastMonthGroup[] {
  const byMonth = new Map<string, ForecastDayRow[]>();

  for (const row of rows) {
    const key = row.stat_date.slice(0, 7);
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(row);
    else byMonth.set(key, [row]);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, days]) => {
      const sortedDays = [...days].sort((a, b) =>
        b.stat_date.localeCompare(a.stat_date),
      );
      return {
        key,
        label: format(parseISO(`${key}-01`), "MMMM yyyy"),
        days: sortedDays,
        totalImplForDay: sortedDays.reduce(
          (sum, day) => sum + day.impl_for_day,
          0,
        ),
      };
    });
}

function ForecastDayCard({ row }: { row: ForecastDayRow }) {
  return (
    <div className="border-card-border bg-background/40 grid gap-2 rounded-lg border px-3 py-2.5 sm:grid-cols-[minmax(120px,1fr)_repeat(3,minmax(0,1fr))] sm:items-center sm:gap-4">
      <p className="text-sm font-medium">{formatDisplayDate(row.stat_date)}</p>
      <Metric label="Covered total" value={formatNumber(row.implemented_count)} />
      <Metric label="Pending" value={formatNumber(row.pending)} />
      <Metric
        label="Covered for day"
        value={formatNumber(row.impl_for_day)}
        accent={row.impl_for_day > 0}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-muted text-xs">{label}</p>
      <p className={cn("text-sm font-medium tabular-nums", accent && "text-success")}>
        {value}
      </p>
    </div>
  );
}

export function DailyForecastAccordion({ rows }: { rows: ForecastDayRow[] }) {
  const months = useMemo(() => groupForecastByMonth(rows), [rows]);
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => {
    const initial = months[0]?.key;
    return initial ? new Set([initial]) : new Set();
  });

  function toggleMonth(key: string) {
    setOpenMonths((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (months.length === 0) {
    return <p className="text-muted text-sm">No daily forecast data available.</p>;
  }

  return (
    <div className="space-y-2">
      {months.map((month) => {
        const isOpen = openMonths.has(month.key);
        return (
          <div
            key={month.key}
            className="border-card-border overflow-hidden rounded-lg border"
          >
            <button
              type="button"
              onClick={() => toggleMonth(month.key)}
              className="hover:bg-white/5 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="text-muted h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="text-muted h-4 w-4 shrink-0" />
                )}
                <span className="font-medium">{month.label}</span>
              </span>
              <span className="text-muted text-sm">
                {month.days.length} day{month.days.length === 1 ? "" : "s"} ·{" "}
                {formatNumber(month.totalImplForDay)} covered for month
              </span>
            </button>
            {isOpen ? (
              <div className="border-card-border space-y-2 border-t px-4 py-3">
                {month.days.map((day) => (
                  <ForecastDayCard key={day.stat_date} row={day} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
