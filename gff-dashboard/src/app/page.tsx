"use client";

import Link from "next/link";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EcuPriorityEditor } from "@/components/ecu-priority-editor";
import { ProgressBar, ProgressBarLegend } from "@/components/progress-bar";
import {
  Card,
  EmptyTableCell,
  FilterInput,
  PageHeader,
  SelectInput,
} from "@/components/ui";
import type { EcuCompletion, VehicleProjectId } from "@/lib/types";
import { cn, compareEcuCodeHex, formatNumber, formatPercent } from "@/lib/utils";

const PROJECTS: VehicleProjectId[] = ["LB74x", "LB636", "LB63x"];

type SortField = "priority" | VehicleProjectId;
type SortDirection = "asc" | "desc";

function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted",
      )}
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </button>
  );
}

export default function DashboardPage() {
  const [ecus, setEcus] = useState<EcuCompletion[]>([]);
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (priority) params.set("priority", priority);
    if (search) params.set("search", search);

    setLoading(true);
    fetch(`/api/ecus?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setEcus(data))
      .finally(() => setLoading(false));
  }, [priority, search]);

  const sortedEcus = useMemo(() => {
    const copy = [...ecus];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === "priority") {
        cmp = a.priority - b.priority || compareEcuCodeHex(a.code, b.code);
      } else {
        const aStats = a.projects[sortField];
        const bStats = b.projects[sortField];
        if (!aStats && !bStats) cmp = 0;
        else if (!aStats) cmp = 1;
        else if (!bStats) cmp = -1;
        else cmp = aStats.completion_pct - bStats.completion_pct;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [ecus, sortField, sortDirection]);

  const summary = useMemo(() => {
    const totals = { covered: 0, pending: 0, total: 0 };
    for (const ecu of sortedEcus) {
      for (const project of PROJECTS) {
        const stats = ecu.projects[project];
        if (!stats) continue;
        totals.covered += stats.covered;
        totals.pending += stats.pending;
        totals.total += stats.total;
      }
    }
    return {
      ecuCount: sortedEcus.length,
      coverageSlots: totals.total,
      completion: totals.total > 0 ? totals.covered / totals.total : 0,
    };
  }, [sortedEcus]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "priority" ? "asc" : "desc");
    }
  }

  function updateEcuPriority(ecuId: string, nextPriority: number) {
    setEcus((current) =>
      current.map((ecu) =>
        ecu.id === ecuId ? { ...ecu, priority: nextPriority } : ecu,
      ),
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-muted text-sm">ECUs shown</p>
          <p className="mt-2 text-3xl font-semibold">{summary.ecuCount}</p>
        </Card>
        <Card>
          <p className="text-muted text-sm">Coverage slots (filtered)</p>
          <p className="mt-2 text-3xl font-semibold">
            {formatNumber(summary.coverageSlots)}
          </p>
        </Card>
        <Card>
          <p className="text-muted text-sm">Coverage completion</p>
          <p className="mt-2 text-3xl font-semibold">
            {formatPercent(summary.completion)}
          </p>
          <p className="text-muted mt-1 text-xs">Covered / coverage slots</p>
        </Card>
        <Card>
          <p className="text-muted text-sm">Vehicle projects</p>
          <p className="mt-2 text-3xl font-semibold">3</p>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <SelectInput
            value={priority}
            onChange={setPriority}
            options={[
              { value: "", label: "All priorities" },
              { value: "1", label: "PRIO 1" },
              { value: "2", label: "PRIO 2" },
              { value: "3", label: "PRIO 3" },
            ]}
          />
          <FilterInput
            value={search}
            onChange={setSearch}
            placeholder="Search ECU code (e.g. 0001, DA0001)"
          />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-card-border border-b px-4 py-3">
          <ProgressBarLegend />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-card-border bg-white/5 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">ECU</th>
                <th className="px-4 py-3">
                  <SortHeader
                    label="Priority"
                    active={sortField === "priority"}
                    direction={sortDirection}
                    onClick={() => toggleSort("priority")}
                  />
                </th>
                {PROJECTS.map((project, index) => (
                  <th
                    key={project}
                    className={cn(
                      "min-w-[180px] px-4 py-3",
                      index < PROJECTS.length - 1 && "border-card-border border-r",
                    )}
                  >
                    <SortHeader
                      label={project}
                      active={sortField === project}
                      direction={sortDirection}
                      onClick={() => toggleSort(project)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-muted px-4 py-8 text-center">
                    Loading ECUs...
                  </td>
                </tr>
              ) : sortedEcus.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted px-4 py-8 text-center">
                    No ECUs match the current filters.
                  </td>
                </tr>
              ) : (
                sortedEcus.map((ecu) => (
                  <tr
                    key={ecu.id}
                    className="border-card-border hover:bg-white/5 border-b last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/ecu/${ecu.id}`}
                        className="text-accent font-medium hover:underline"
                      >
                        {ecu.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <EcuPriorityEditor
                        ecuId={ecu.id}
                        priority={ecu.priority}
                        onUpdated={(nextPriority) =>
                          updateEcuPriority(ecu.id, nextPriority)
                        }
                      />
                    </td>
                    {PROJECTS.map((project, index) => {
                      const stats = ecu.projects[project];
                      if (!stats) {
                        return (
                          <td
                            key={project}
                            className={cn(
                              "px-4 py-3",
                              index < PROJECTS.length - 1 &&
                                "border-card-border border-r",
                            )}
                          >
                            <EmptyTableCell />
                          </td>
                        );
                      }
                      return (
                        <td
                          key={project}
                          className={cn(
                            "px-4 py-3",
                            index < PROJECTS.length - 1 &&
                              "border-card-border border-r",
                          )}
                        >
                          <ProgressBar
                            segments={{
                              covered: stats.covered,
                              pending: stats.pending,
                              faulty: stats.faulty,
                            }}
                            label={`${stats.covered}/${stats.total}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
