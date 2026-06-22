"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CoverageBadge } from "@/components/coverage-badge";
import { PriorityBadge } from "@/components/priority-badge";
import {
  Button,
  Card,
  FilterInput,
  PageHeader,
  SelectInput,
} from "@/components/ui";
import type { CoverageStatus, VehicleProjectId } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

const PROJECTS: VehicleProjectId[] = ["LB74x", "LB636", "LB63x"];

interface SearchRow {
  id: number;
  ecu_id: string;
  ecu_code: string;
  ecu_priority: number;
  symptom: string | null;
  trouble_code: string | null;
  dtc_text: string | null;
  category: number | null;
  gff_program: string | null;
  coverage_lb74x: CoverageStatus | null;
  coverage_lb636: CoverageStatus | null;
  coverage_lb63x: CoverageStatus | null;
  applicable_lb74x?: number;
  applicable_lb636?: number;
  applicable_lb63x?: number;
}

function projectFields(row: SearchRow, projectName: VehicleProjectId) {
  if (projectName === "LB74x") {
    return {
      coverage: row.coverage_lb74x,
      applicable: !!row.applicable_lb74x,
    };
  }
  if (projectName === "LB636") {
    return {
      coverage: row.coverage_lb636,
      applicable: !!row.applicable_lb636,
    };
  }
  return {
    coverage: row.coverage_lb63x,
    applicable: !!row.applicable_lb63x,
  };
}

function rowKey(dtcId: number, project: VehicleProjectId) {
  return `${dtcId}:${project}`;
}

export default function SearchPage() {
  const [items, setItems] = useState<SearchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [coverage, setCoverage] = useState("");
  const [project, setProject] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProject, setBulkProject] = useState<VehicleProjectId>("LB74x");
  const [bulkStatus, setBulkStatus] = useState<CoverageStatus>("covered");
  const [applying, setApplying] = useState(false);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "50",
    });
    if (search) params.set("search", search);
    if (coverage) params.set("coverage", coverage);
    if (project) params.set("project", project);

    setLoading(true);
    const response = await fetch(`/api/dtcs/search?${params.toString()}`);
    const json = (await response.json()) as {
      items: SearchRow[];
      total: number;
    };
    setItems(json.items ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [page, search, coverage, project]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  function toggleSelect(dtcId: number, projectName: VehicleProjectId) {
    const key = rowKey(dtcId, projectName);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllVisible() {
    const next = new Set(selected);
    for (const row of items) {
      for (const projectName of PROJECTS) {
        const { applicable } = projectFields(row, projectName);
        if (applicable) next.add(rowKey(row.id, projectName));
      }
    }
    setSelected(next);
  }

  async function applyBulk(selectedOnly: boolean) {
    setApplying(true);
    try {
      const payload = selectedOnly
        ? {
            items: [...selected].map((key) => {
              const [dtcId, proj] = key.split(":");
              return {
                dtcId: Number(dtcId),
                project: proj as VehicleProjectId,
                status: bulkStatus,
              };
            }),
          }
        : {
            applyToAllMatching: true,
            bulkProject,
            bulkStatus,
            filters: {
              search: search || undefined,
              coverage: (coverage as CoverageStatus) || undefined,
              project: (project as VehicleProjectId) || undefined,
            },
          };

      const response = await fetch("/api/dtcs/search", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        updated?: number;
        skipped?: number;
      };

      if (!response.ok) {
        toast.error(result.error ?? "Bulk update failed");
        return;
      }

      toast.success(`Updated ${result.updated ?? 0} row(s)`, {
        description:
          (result.skipped ?? 0) > 0
            ? `${result.skipped} skipped (already in target state or N/A)`
            : undefined,
      });
      setSelected(new Set());
      await loadData();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global DTC search"
        description="Search DTCs across all ECUs. Select rows and apply bulk coverage updates with a single aggregated audit entry."
      />

      <Card className="grid gap-3 lg:grid-cols-3">
        <FilterInput
          value={search}
          onChange={(value) => {
            setPage(1);
            setSearch(value);
          }}
          placeholder="Search code, symptom, text, ECU..."
        />
        <SelectInput
          value={coverage}
          onChange={(value) => {
            setPage(1);
            setCoverage(value);
          }}
          options={[
            { value: "", label: "All coverage states" },
            { value: "pending", label: "Pending" },
            { value: "covered", label: "Covered" },
          ]}
        />
        <SelectInput
          value={project}
          onChange={(value) => {
            setPage(1);
            setProject(value);
          }}
          options={[
            { value: "", label: "All projects" },
            ...PROJECTS.map((value) => ({ value, label: value })),
          ]}
        />
      </Card>

      <Card>
        <h3 className="mb-3 font-medium">Bulk update</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Project</span>
            <SelectInput
              value={bulkProject}
              onChange={(v) => setBulkProject(v as VehicleProjectId)}
              options={PROJECTS.map((p) => ({ value: p, label: p }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Set status</span>
            <SelectInput
              value={bulkStatus}
              onChange={(v) => setBulkStatus(v as CoverageStatus)}
              options={[
                { value: "pending", label: "Pending" },
                { value: "covered", label: "Covered" },
              ]}
            />
          </label>
          <Button
            disabled={applying || selected.size === 0}
            onClick={() => applyBulk(true)}
          >
            Apply to selected ({selected.size})
          </Button>
          <Button
            variant="secondary"
            disabled={applying || total === 0}
            onClick={() => applyBulk(false)}
          >
            Apply to all matching ({formatNumber(total)})
          </Button>
          <Button variant="secondary" onClick={selectAllVisible}>
            Select visible
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-card-border flex items-center justify-between border-b px-4 py-3">
          <p className="text-muted text-sm">
            {formatNumber(total)} matching DTC rows
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-muted text-sm">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-card-border bg-white/5 border-b">
              <tr className="text-muted text-left">
                <th className="px-3 py-3">ECU</th>
                <th className="px-3 py-3">Prio</th>
                <th className="px-3 py-3">Symptom</th>
                <th className="px-3 py-3">Code</th>
                <th className="px-3 py-3">Text</th>
                {PROJECTS.map((p) => (
                  <th key={p} className="px-3 py-3">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-muted px-4 py-8 text-center">
                    Searching...
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-card-border hover:bg-white/5 border-b align-top last:border-b-0"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/ecu/${row.ecu_id}`}
                        className="text-accent hover:underline"
                      >
                        {row.ecu_code}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <PriorityBadge priority={row.ecu_priority} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {row.symptom}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {row.trouble_code}
                    </td>
                    <td className="max-w-xs px-3 py-3">{row.dtc_text}</td>
                    {PROJECTS.map((projectName) => {
                      const { coverage, applicable } = projectFields(
                        row,
                        projectName,
                      );

                      if (!applicable) {
                        return (
                          <td key={projectName} className="text-muted px-3 py-3">
                            —
                          </td>
                        );
                      }

                      const key = rowKey(row.id, projectName);
                      const checked = selected.has(key);

                      return (
                        <td key={projectName} className="px-3 py-3">
                          <label className="flex cursor-pointer flex-col gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleSelect(row.id, projectName)
                              }
                              className="h-4 w-4"
                            />
                            {coverage ? (
                              <CoverageBadge status={coverage} />
                            ) : (
                              <span className="text-muted text-xs">Unset</span>
                            )}
                          </label>
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
