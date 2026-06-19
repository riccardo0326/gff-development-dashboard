"use client";

import Link from "next/link";
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
import { formatPercent } from "@/lib/utils";

const PROJECTS: VehicleProjectId[] = ["LB74x", "LB636", "LB63x"];

export default function DashboardPage() {
  const [ecus, setEcus] = useState<EcuCompletion[]>([]);
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
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

  const summary = useMemo(() => {
    const totals = { covered: 0, pending: 0 };
    for (const ecu of ecus) {
      for (const project of PROJECTS) {
        const stats = ecu.projects[project];
        if (!stats) continue;
        totals.covered += stats.covered;
        totals.pending += stats.pending;
      }
    }
    const all = totals.covered + totals.pending;
    return {
      ecuCount: ecus.length,
      completion: all > 0 ? totals.covered / all : 0,
    };
  }, [ecus]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="ECU completion overview across vehicle projects. Pending means the DTC exists but is not yet covered by a GFF. Covered means a GFF is already in place."
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
              <tr className="text-muted text-left">
                <th className="px-4 py-3 font-medium">ECU</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                {PROJECTS.map((project) => (
                  <th key={project} className="min-w-[180px] px-4 py-3 font-medium">
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
              ) : ecus.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted px-4 py-8 text-center">
                    No ECUs match the current filters.
                  </td>
                </tr>
              ) : (
                ecus.map((ecu) => (
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
