"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BackToDashboard } from "@/components/back-to-dashboard";
import { CoverageBadge } from "@/components/coverage-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import {
  Button,
  Card,
  FilterInput,
  PageHeader,
  SelectInput,
} from "@/components/ui";
import type {
  CoverageStatus,
  Dtc,
  Ecu,
  ProjectCompletion,
  VehicleProjectId,
} from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/utils";

const PROJECTS: VehicleProjectId[] = ["LB74x", "LB636", "LB63x"];

interface EcuResponse {
  ecu: Ecu;
  completion: Record<VehicleProjectId, ProjectCompletion | null> | null;
  categories: number[];
  items: Dtc[];
  total: number;
  page: number;
  pageSize: number;
}

export default function EcuDetailPage() {
  const params = useParams<{ id: string }>();
  const ecuId = params.id;

  const [data, setData] = useState<EcuResponse | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [coverage, setCoverage] = useState("");
  const [project, setProject] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    const paramsObj = new URLSearchParams({
      page: String(page),
      pageSize: "100",
    });
    if (search) paramsObj.set("search", search);
    if (category) paramsObj.set("category", category);
    if (coverage) paramsObj.set("coverage", coverage);
    if (project) paramsObj.set("project", project);

    setLoading(true);
    const response = await fetch(`/api/ecus/${ecuId}?${paramsObj.toString()}`);
    const json = (await response.json()) as EcuResponse;
    setData(json);
    setLoading(false);
  }, [ecuId, page, search, category, coverage, project]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function updateCoverage(
    dtcId: number,
    projectName: VehicleProjectId,
    status: CoverageStatus,
  ) {
    setSavingId(dtcId);
    const response = await fetch(`/api/ecus/${ecuId}/dtcs/${dtcId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: projectName, status }),
    });
    const payload = (await response.json()) as {
      dailyUpdate?: { impl_for_day: number; impl_for_day_auto?: number };
    };

    if (payload.dailyUpdate) {
      const autoCount =
        payload.dailyUpdate.impl_for_day_auto ?? payload.dailyUpdate.impl_for_day;
      setNotice(
        status === "covered"
          ? `Daily count updated: ${autoCount} GFF(s) covered today (auto-tracked).`
          : `Daily count updated: ${autoCount} GFF(s) covered today after revert.`,
      );
    }

    await loadData();
    setSavingId(null);
  }

  if (!data && loading) {
    return (
      <div>
        <PageHeader title="ECU detail" />
        <Card>
          <p className="text-muted text-sm">Loading ECU data...</p>
        </Card>
      </div>
    );
  }

  if (!data?.ecu) {
    return (
      <div>
        <PageHeader title="ECU not found" />
        <BackToDashboard />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`ECU ${data.ecu.code}`}
        description="Review and update DTC coverage per vehicle project. Empty cells mean the DTC does not exist for that project."
        actions={<BackToDashboard />}
      />

      {notice ? (
        <Card>
          <p className="text-success text-sm">{notice}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-muted text-sm">Priority</p>
          <div className="mt-2">
            <PriorityBadge priority={data.ecu.priority} />
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <p className="text-muted mb-3 text-sm">Project completion</p>
          <div className="grid gap-4 md:grid-cols-3">
            {PROJECTS.map((projectName) => {
              const stats = data.completion?.[projectName];
              if (!stats) {
                return (
                  <div key={projectName}>
                    <p className="mb-1 text-sm font-medium">{projectName}</p>
                    <p className="text-muted text-sm">Not applicable</p>
                  </div>
                );
              }
              return (
                <div key={projectName}>
                  <ProgressBar
                    value={stats.completion_pct}
                    label={`${projectName} (${formatPercent(stats.completion_pct)})`}
                  />
                  <p className="text-muted mt-1 text-xs">
                    {formatNumber(stats.covered)} covered / {formatNumber(stats.total)} total
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="grid gap-3 lg:grid-cols-4">
        <FilterInput
          value={search}
          onChange={(value) => {
            setPage(1);
            setSearch(value);
          }}
          placeholder="Search DTC, symptom, category..."
        />
        <SelectInput
          value={category}
          onChange={(value) => {
            setPage(1);
            setCategory(value);
          }}
          options={[
            { value: "", label: "All categories" },
            ...data.categories.map((value) => ({
              value: String(value),
              label: `Category ${value}`,
            })),
          ]}
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

      <Card className="overflow-hidden p-0">
        <div className="border-card-border flex items-center justify-between border-b px-4 py-3">
          <p className="text-muted text-sm">
            {formatNumber(data.total)} DTC rows
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
                <th className="px-3 py-3">Symptom</th>
                <th className="px-3 py-3">Code</th>
                <th className="px-3 py-3">Text</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">GFF program</th>
                {PROJECTS.map((projectName) => (
                  <th key={projectName} className="px-3 py-3">
                    {projectName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-muted px-4 py-8 text-center">
                    Loading DTC rows...
                  </td>
                </tr>
              ) : (
                data.items.map((dtc) => (
                  <tr
                    key={dtc.id}
                    className="border-card-border hover:bg-white/5 border-b align-top last:border-b-0"
                  >
                    <td className="px-3 py-3 font-mono text-xs">{dtc.symptom}</td>
                    <td className="px-3 py-3 font-mono text-xs">{dtc.trouble_code}</td>
                    <td className="max-w-xs px-3 py-3">{dtc.dtc_text}</td>
                    <td className="px-3 py-3">{dtc.category ?? "—"}</td>
                    <td className="max-w-xs px-3 py-3 font-mono text-xs">
                      {dtc.gff_program ?? "—"}
                    </td>
                    {PROJECTS.map((projectName) => {
                      const column =
                        projectName === "LB74x"
                          ? dtc.coverage_lb74x
                          : projectName === "LB636"
                            ? dtc.coverage_lb636
                            : dtc.coverage_lb63x;

                      if (!column) {
                        return (
                          <td key={projectName} className="text-muted px-3 py-3">
                            —
                          </td>
                        );
                      }

                      return (
                        <td key={projectName} className="px-3 py-3">
                          <div className="flex flex-col gap-2">
                            <CoverageBadge status={column} />
                            <select
                              value={column}
                              disabled={savingId === dtc.id}
                              onChange={(e) =>
                                updateCoverage(
                                  dtc.id,
                                  projectName,
                                  e.target.value as CoverageStatus,
                                )
                              }
                              className="border-card-border bg-background rounded-md border px-2 py-1 text-xs"
                            >
                              <option value="pending">Pending</option>
                              <option value="covered">Covered</option>
                            </select>
                          </div>
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
