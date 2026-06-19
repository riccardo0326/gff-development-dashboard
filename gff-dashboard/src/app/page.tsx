"use client";

import Link from "next/link";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import {
  Card,
  FilterInput,
  PageHeader,
  SelectInput,
} from "@/components/ui";
import type { EcuCompletion, VehicleProjectId } from "@/lib/types";
import { cn, formatPercent } from "@/lib/utils";

const PROJECTS: VehicleProjectId[] = ["LB74x", "LB636", "LB63x"];

type SortField = "ecu" | "priority";
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
      if (sortField === "ecu") {
        cmp = a.code.localeCompare(b.code, undefined, { numeric: true });
      } else {
        cmp = a.priority - b.priority || a.code.localeCompare(b.code, undefined, { numeric: true });
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [ecus, sortField, sortDirection]);

  const summary = useMemo(() => {
    const totals = { covered: 0, pending: 0 };
    for (const ecu of sortedEcus) {
      for (const project of PROJECTS) {
        const stats = ecu.projects[project];
        if (!stats) continue;
        totals.covered += stats.covered;
        totals.pending += stats.pending;
      }
    }
    const all = totals.covered + totals.pending;
    return {
      ecuCount: sortedEcus.length,
      completion: all > 0 ? totals.covered / all : 0,
    };
  }, [sortedEcus]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "priority" ? "asc" : "asc");
    }
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        actions={
          <Link
            href="/daily-gffs"
            className="bg-accent hover:bg-blue-500 inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            Add daily GFFs
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-muted text-sm">ECUs shown</p>
          <p className="mt-2 text-3xl font-semibold">{summary.ecuCount}</p>
        </Card>
        <Card>
          <p className="text-muted text-sm">Filtered completion</p>
          <p className="mt-2 text-3xl font-semibold">
            {formatPercent(summary.completion)}
          </p>
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-card-border bg-white/5 border-b">
              <tr className="text-left">
                <th className="px-4 py-3">
                  <SortHeader
                    label="ECU"
                    active={sortField === "ecu"}
                    direction={sortDirection}
                    onClick={() => toggleSort("ecu")}
                  />
                </th>
                <th className="px-4 py-3">
                  <SortHeader
                    label="Priority"
                    active={sortField === "priority"}
                    direction={sortDirection}
                    onClick={() => toggleSort("priority")}
                  />
                </th>
                {PROJECTS.map((project) => (
                  <th
                    key={project}
                    className="text-muted min-w-[180px] px-4 py-3 font-medium"
                  >
                    {project}
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
                      <PriorityBadge priority={ecu.priority} />
                    </td>
                    {PROJECTS.map((project) => {
                      const stats = ecu.projects[project];
                      if (!stats) {
                        return (
                          <td key={project} className="text-muted px-4 py-3">
                            n/a
                          </td>
                        );
                      }
                      return (
                        <td key={project} className="px-4 py-3">
                          <ProgressBar
                            value={stats.completion_pct}
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
