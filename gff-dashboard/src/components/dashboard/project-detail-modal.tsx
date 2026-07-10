"use client";

import Image from "next/image";
import { useEffect } from "react";
import { X } from "lucide-react";
import { KpiCard } from "@/components/statistics/kpi-card";
import { ProgressBar, ProgressBarLegend } from "@/components/progress-bar";
import { Button, Card } from "@/components/ui";
import { addWorkdays, formatDisplayDate } from "@/lib/calculations";
import type { PriorityStats, VehicleProjectId } from "@/lib/types";
import { format, startOfToday } from "date-fns";
import { formatNumber, formatPercent } from "@/lib/utils";
import { PROJECT_CARDS } from "./vehicle-project-banner";

interface ProjectDetailModalProps {
  project: VehicleProjectId | null;
  priorityStats: PriorityStats[];
  open: boolean;
  onClose: () => void;
}

const PRIORITY_LABELS = ["Prio1", "Prio2", "Prio3"] as const;

export function ProjectDetailModal({
  project,
  priorityStats,
  open,
  onClose,
}: ProjectDetailModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !project) return null;

  const card = PROJECT_CARDS.find((entry) => entry.id === project);
  const tot = priorityStats.find((row) => row.label === "TOT");
  const slice = tot?.segments[project];
  const completion = tot?.completion[project] ?? 0;

  if (!card || !slice || !tot) return null;

  const slots = slice.covered + slice.pending + slice.faulty;
  const remaining = slice.pending + slice.faulty;
  const dailyAverage = tot.daily_average ?? 0;
  const daysRequired =
    dailyAverage > 0 ? Math.ceil(remaining / dailyAverage) : null;
  const endDateAverage =
    daysRequired != null
      ? format(addWorkdays(startOfToday(), daysRequired), "yyyy-MM-dd")
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <div
        className="border-card-border bg-card max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-28 shrink-0">
              <Image
                src={card.image}
                alt={`Lamborghini ${card.model}`}
                fill
                className="object-contain object-center"
                sizes="112px"
              />
            </div>
            <div>
              <h3
                id="project-modal-title"
                className="text-xl font-semibold tracking-[0.15em]"
                style={{ color: card.accent }}
              >
                {project}
              </h3>
              <p className="text-muted text-sm uppercase tracking-widest">
                {card.model}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground rounded-lg p-1 hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Coverage slots" value={formatNumber(slots)} />
          <KpiCard
            label="Covered"
            value={formatNumber(slice.covered)}
            accent="success"
          />
          <KpiCard
            label="Pending"
            value={formatNumber(slice.pending)}
            accent="warning"
          />
          <KpiCard label="Faulty" value={formatNumber(slice.faulty)} />
          <KpiCard
            label="Completion"
            value={formatPercent(completion)}
            accent="accent"
          />
        </div>

        <Card className="mt-5 space-y-3">
          <p className="text-sm font-medium">Coverage progress</p>
          <ProgressBarLegend />
          <ProgressBar
            segments={{
              covered: slice.covered,
              pending: slice.pending,
              faulty: slice.faulty,
            }}
            label={`${slice.covered}/${slots}`}
          />
        </Card>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Card className="border-success/30 bg-success/5">
            <p className="text-foreground/80 text-xs font-semibold tracking-wide uppercase">
              Forecast (average rate)
            </p>
            <p className="mt-2 text-xl font-semibold">
              {daysRequired != null ? `${formatNumber(daysRequired)} days` : "—"}
            </p>
            <p className="text-muted mt-1 text-xs">
              Based on daily average of {formatNumber(Math.round(dailyAverage))}{" "}
              GFF/day
            </p>
          </Card>
          <Card className="border-success/30 bg-success/5">
            <p className="text-foreground/80 text-xs font-semibold tracking-wide uppercase">
              Est. end date (average)
            </p>
            <p className="mt-2 text-xl font-semibold">
              {endDateAverage ? formatDisplayDate(endDateAverage) : "—"}
            </p>
            <p className="text-muted mt-1 text-xs">
              Pending + faulty slots at current pace
            </p>
          </Card>
        </div>

        <Card className="mt-5 overflow-hidden p-0">
          <div className="border-card-border border-b px-4 py-3">
            <p className="text-sm font-medium">Priority breakdown</p>
          </div>
          <table className="min-w-full text-sm">
            <thead className="border-card-border bg-white/5 border-b">
              <tr className="text-muted text-left">
                <th className="px-4 py-2">Scope</th>
                <th className="px-4 py-2">Covered</th>
                <th className="px-4 py-2">Pending</th>
                <th className="px-4 py-2">Faulty</th>
                <th className="px-4 py-2">Completion</th>
              </tr>
            </thead>
            <tbody>
              {PRIORITY_LABELS.map((label) => {
                const row = priorityStats.find((entry) => entry.label === label);
                const projectSlice = row?.segments[project];
                if (!row || !projectSlice) return null;
                const projectSlots =
                  projectSlice.covered +
                  projectSlice.pending +
                  projectSlice.faulty;
                const projectCompletion = row.completion[project] ?? 0;

                return (
                  <tr
                    key={label}
                    className="border-card-border border-b last:border-b-0"
                  >
                    <td className="px-4 py-2 font-medium">{label}</td>
                    <td className="px-4 py-2">{formatNumber(projectSlice.covered)}</td>
                    <td className="px-4 py-2">{formatNumber(projectSlice.pending)}</td>
                    <td className="px-4 py-2">{formatNumber(projectSlice.faulty)}</td>
                    <td className="px-4 py-2">{formatPercent(projectCompletion)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button href={`/search?project=${project}&coverage=pending`}>
            View pending DTCs
          </Button>
          <Button
            variant="secondary"
            href={`/search?project=${project}&faultyOnly=1`}
          >
            View faulty DTCs
          </Button>
        </div>
      </div>
    </div>
  );
}
