"use client";

import { CoverageBadge } from "@/components/coverage-badge";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DTC_PROJECTS,
  DtcDataTable,
  dtcSelectionKey,
} from "@/components/dtc/dtc-data-table";
import { DtcDetailModal } from "@/components/dtc/dtc-detail-modal";
import type { DtcRowData } from "@/components/dtc/dtc-types";
import { projectCoverage } from "@/components/dtc/dtc-types";
import { PriorityBadge } from "@/components/priority-badge";
import {
  Button,
  Card,
  FilterInput,
  PageHeader,
  SelectInput,
} from "@/components/ui";
import { VisualizationFilter } from "@/components/visualization-filter";
import type { CoverageStatus, VehicleProjectId } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export default function SearchPage() {
  const [items, setItems] = useState<DtcRowData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [coverage, setCoverage] = useState("");
  const [project, setProject] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<CoverageStatus>("covered");
  const [applying, setApplying] = useState(false);
  const [modalDtc, setModalDtc] = useState<DtcRowData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEdit, setModalEdit] = useState(false);

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
      items: DtcRowData[];
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
    const key = dtcSelectionKey(dtcId, projectName);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectFiltered() {
    const next = new Set(selected);
    const projectsToSelect = project
      ? [project as VehicleProjectId]
      : DTC_PROJECTS;
    for (const row of items) {
      if (!row.id) continue;
      for (const projectName of projectsToSelect) {
        const { applicable } = projectCoverage(row, projectName);
        if (applicable) next.add(dtcSelectionKey(row.id, projectName));
      }
    }
    setSelected(next);
  }

  function unselectAll() {
    setSelected(new Set());
  }

  async function applyBulk() {
    setApplying(true);
    try {
      const response = await fetch("/api/dtcs/search", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [...selected].map((key) => {
            const [dtcId, proj] = key.split(":");
            return {
              dtcId: Number(dtcId),
              project: proj as VehicleProjectId,
              status: bulkStatus,
            };
          }),
        }),
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

      toast.success(`Updated ${result.updated ?? 0} row(s)`);
      setSelected(new Set());
      await loadData();
    } finally {
      setApplying(false);
    }
  }

  async function toggleGff(row: DtcRowData, checked: boolean) {
    if (!row.id || !row.ecu_id) return;
    await fetch(`/api/ecus/${row.ecu_id}/dtcs/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gff_available: checked }),
    });
    await loadData();
  }

  function openModal(row: DtcRowData, edit = false) {
    setModalDtc(row);
    setModalEdit(edit);
    setModalOpen(true);
  }

  const tableRows = items.map((row) => ({
    ...row,
    ecu_priority: row.ecu_priority,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global DTC search"
        description="Search DTCs across all ECUs. Click a row for full details including error handling fields."
      />

      <VisualizationFilter>
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
            ...DTC_PROJECTS.map((value) => ({ value, label: value })),
          ]}
        />
      </VisualizationFilter>

      <Card>
        <h3 className="mb-3 font-medium">Bulk update</h3>
        <div className="flex flex-wrap items-end gap-3">
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
            onClick={applyBulk}
          >
            Apply to selected ({selected.size})
          </Button>
          <Button variant="secondary" onClick={selectFiltered}>
            Select filtered
          </Button>
          {selected.size > 0 ? (
            <Button variant="secondary" onClick={unselectAll}>
              Unselect
            </Button>
          ) : null}
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
                <th className="px-3 py-3">GFF</th>
                <th className="px-3 py-3">GFF name</th>
                {DTC_PROJECTS.map((p) => (
                  <th key={p} className="px-3 py-3">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-muted px-4 py-8 text-center">
                    Searching...
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-card-border hover:bg-accent-soft/40 cursor-pointer border-b align-top transition-colors last:border-b-0"
                    onClick={() => openModal(row)}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/ecu/${row.ecu_id}`}
                        className="text-accent hover:underline"
                      >
                        {row.ecu_code}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {row.ecu_priority ? (
                        <PriorityBadge priority={row.ecu_priority} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{row.symptom}</td>
                    <td className="px-3 py-3 font-mono text-xs">{row.trouble_code}</td>
                    <td className="max-w-[160px] truncate px-3 py-3">{row.dtc_text}</td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={row.gff_available === "y"}
                        onChange={(e) => toggleGff(row, e.target.checked)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => openModal(row, true)}
                      >
                        {row.gff_program?.slice(0, 24) ?? "—"}
                        {(row.gff_program?.length ?? 0) > 24 ? "…" : ""}
                      </button>
                    </td>
                    {DTC_PROJECTS.map((projectName) => {
                      const { coverage: cov, applicable } = projectCoverage(
                        row,
                        projectName,
                      );
                      const showSelection =
                        applicable &&
                        (!project || project === projectName);

                      return (
                        <td
                          key={projectName}
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!applicable ? (
                            "—"
                          ) : (
                            <div className="flex flex-col gap-1">
                              {showSelection && row.id ? (
                                <input
                                  type="checkbox"
                                  checked={selected.has(
                                    dtcSelectionKey(row.id, projectName),
                                  )}
                                  onChange={() =>
                                    toggleSelect(row.id!, projectName)
                                  }
                                  className="h-4 w-4"
                                />
                              ) : null}
                              {cov ? (
                                <CoverageBadge status={cov} />
                              ) : (
                                <span className="text-muted text-xs">Unset</span>
                              )}
                            </div>
                          )}
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

      <DtcDetailModal
        dtc={modalDtc}
        ecuId={modalDtc?.ecu_id}
        open={modalOpen}
        initialEdit={modalEdit}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
      />
    </div>
  );
}
