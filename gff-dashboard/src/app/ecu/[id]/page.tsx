"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BackToDashboard } from "@/components/back-to-dashboard";
import {
  DTC_PROJECTS,
  DtcDataTable,
  dtcSelectionKey,
} from "@/components/dtc/dtc-data-table";
import { DtcDetailModal } from "@/components/dtc/dtc-detail-modal";
import type { DtcRowData } from "@/components/dtc/dtc-types";
import { PriorityBadge } from "@/components/priority-badge";
import { ProgressBar } from "@/components/progress-bar";
import {
  Button,
  Card,
  EmptyTableCell,
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
import { projectCoverage } from "@/components/dtc/dtc-types";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<CoverageStatus>("covered");
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [modalDtc, setModalDtc] = useState<DtcRowData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEdit, setModalEdit] = useState(false);

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
    if (!data?.items) return;
    const next = new Set(selected);
    const projectsToSelect = project
      ? [project as VehicleProjectId]
      : DTC_PROJECTS;
    for (const dtc of data.items) {
      for (const projectName of projectsToSelect) {
        const { applicable } = projectCoverage(dtc, projectName);
        if (applicable) next.add(dtcSelectionKey(dtc.id, projectName));
      }
    }
    setSelected(next);
  }

  function unselectAll() {
    setSelected(new Set());
  }

  async function applyBulk() {
    setApplyingBulk(true);
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
      };

      if (!response.ok) {
        toast.error(result.error ?? "Bulk update failed");
        return;
      }

      toast.success(`Updated ${result.updated ?? 0} row(s)`);
      setSelected(new Set());
      await loadData();
    } finally {
      setApplyingBulk(false);
    }
  }

  async function toggleGff(row: DtcRowData, checked: boolean) {
    if (!row.id) return;
    await fetch(`/api/ecus/${ecuId}/dtcs/${row.id}`, {
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
  const rows: DtcRowData[] = data.items.map((dtc) => ({ ...dtc }));

  return (
    <div className="space-y-6">
      <div>
        <BackToDashboard className="mb-2" />
        <PageHeader
          title={`ECU ${data.ecu.code}`}
          description="Use the pencil icon to edit GFF fields."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="flex items-center justify-center py-6">
          <PriorityBadge priority={data.ecu.priority} size="lg" />
        </Card>
        <Card className="lg:col-span-3">
          <p className="text-muted mb-3 text-sm">Project completion</p>
          <div className="flex w-full flex-col gap-3">
            {DTC_PROJECTS.map((projectName) => {
              const stats = data.completion?.[projectName];
              if (!stats) {
                return (
                  <div key={projectName} className="w-full">
                    <p className="mb-1 text-sm font-medium">{projectName}</p>
                    <EmptyTableCell>Not applicable</EmptyTableCell>
                  </div>
                );
              }
              return (
                <div key={projectName} className="w-full">
                  <ProgressBar
                    value={stats.completion_pct}
                    label={`${projectName} (${formatPercent(stats.completion_pct)})`}
                  />
                  <p className="text-muted mt-1 text-xs">
                    {formatNumber(stats.covered)} covered /{" "}
                    {formatNumber(stats.total)} total
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
            ...DTC_PROJECTS.map((value) => ({ value, label: value })),
          ]}
        />
      </Card>

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
            disabled={applyingBulk || selected.size === 0}
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
          <DtcDataTable
            rows={rows}
            loading={loading}
            showErrorColumns
            selectable
            selected={selected}
            selectionProjectFilter={project as VehicleProjectId | ""}
            onToggleSelect={toggleSelect}
            onRowClick={(row) => openModal(row)}
            onEditGff={(row) => openModal(row, true)}
            onGffToggle={toggleGff}
          />
        </div>
      </Card>

      <DtcDetailModal
        dtc={modalDtc}
        ecuId={ecuId}
        open={modalOpen}
        initialEdit={modalEdit}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
      />
    </div>
  );
}
