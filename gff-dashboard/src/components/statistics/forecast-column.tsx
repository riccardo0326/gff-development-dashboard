"use client";

import { Card } from "@/components/ui";
import type { PriorityStats, VehicleProjectId } from "@/lib/types";
import { formatDisplayDate } from "@/lib/calculations";
import { ProjectProgressPanel } from "./project-progress-panel";

function ForecastMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-foreground/80 text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ForecastMetricGroup({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "estimate" | "average";
  children: React.ReactNode;
}) {
  return (
    <Card
      className={
        tone === "estimate"
          ? "border-accent/30 bg-accent/5 space-y-4"
          : "border-success/30 bg-success/5 space-y-4"
      }
    >
      <p className="text-foreground/80 text-xs font-semibold tracking-wide uppercase">
        {title}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export function ForecastColumn({
  title,
  description,
  stats,
  projects,
  includeFaultyInBar,
}: {
  title: string;
  description: string;
  stats: PriorityStats;
  projects: VehicleProjectId[];
  includeFaultyInBar: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted mt-1 text-sm">{description}</p>
      </div>

      <ForecastMetricGroup title="Estimated (plan rate)" tone="estimate">
        <ForecastMetric
          label="Days required"
          value={
            stats.days_required_estimated != null
              ? String(Math.round(stats.days_required_estimated))
              : "—"
          }
        />
        <ForecastMetric
          label="End date"
          value={
            stats.end_date_estimated
              ? formatDisplayDate(stats.end_date_estimated)
              : "—"
          }
        />
      </ForecastMetricGroup>

      <ForecastMetricGroup title="Average (actual rate)" tone="average">
        <ForecastMetric
          label="Days required"
          value={
            stats.days_required_average != null
              ? String(Math.round(stats.days_required_average))
              : "—"
          }
        />
        <ForecastMetric
          label="End date"
          value={
            stats.end_date_average
              ? formatDisplayDate(stats.end_date_average)
              : "—"
          }
        />
      </ForecastMetricGroup>

      <ProjectProgressPanel
        projects={projects}
        segments={stats.segments}
        completion={stats.completion}
        includeFaultyInBar={includeFaultyInBar}
      />
    </div>
  );
}
