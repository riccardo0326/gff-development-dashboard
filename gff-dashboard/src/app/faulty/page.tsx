"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { DtcDataTable } from "@/components/dtc/dtc-data-table";
import { DtcDetailModal } from "@/components/dtc/dtc-detail-modal";
import type { DtcRowData } from "@/components/dtc/dtc-types";
import {
  Button,
  Card,
  FilterInput,
  PageHeader,
  SelectInput,
} from "@/components/ui";
import { VisualizationFilter } from "@/components/visualization-filter";
import type { FaultyDtc } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

function formatDaLabel(code: string): string {
  const normalized = code.replace(/^DA/i, "");
  return `DA${normalized}`;
}

export default function FaultyPage() {
  const [items, setItems] = useState<FaultyDtc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [daCode, setDaCode] = useState("");
  const [issue, setIssue] = useState("");
  const [daOptions, setDaOptions] = useState<string[]>([]);
  const [issueOptions, setIssueOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [modalDtc, setModalDtc] = useState<DtcRowData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/faulty?options=1")
      .then((res) => res.json())
      .then((data) => {
        setDaOptions(data.daCodes ?? []);
        setIssueOptions(data.issues ?? []);
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (search) params.set("search", search);
    if (daCode) params.set("da_code", daCode);
    if (issue) params.set("issue", issue);

    setLoading(true);
    fetch(`/api/faulty?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, search, daCode, issue]);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  async function handleExport() {
    setExporting(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (daCode) params.set("da_code", daCode);
    if (issue) params.set("issue", issue);

    const response = await fetch(`/api/faulty/export?${params.toString()}`);
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `faulty_dtcs_${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  const rows: DtcRowData[] = items.map((row) => ({
    id: row.matched_dtc_id ?? undefined,
    ecu_id: row.da_code
      ? `DA${row.da_code.replace(/^DA/i, "")}`
      : undefined,
    da_code: row.da_code ?? null,
    ecu_code: row.ecu_code ?? row.da_code ?? undefined,
    symptom: row.symptom,
    trouble_code: row.trouble_code,
    dtc_text: row.dtc_text,
    error_handling: row.error_handling ?? null,
    error_setting_conditions: row.error_setting_conditions ?? null,
    gff_available: row.gff_available ?? null,
    gff_program: row.gff_program ?? null,
    coverage_lb74x: (row.coverage_lb74x as DtcRowData["coverage_lb74x"]) ?? null,
    coverage_lb636:
      (row.coverage_lb636 as DtcRowData["coverage_lb636"]) ?? null,
    coverage_lb63x: (row.coverage_lb63x as DtcRowData["coverage_lb63x"]) ?? null,
    applicable_lb74x: row.applicable_lb74x,
    applicable_lb636: row.applicable_lb636,
    applicable_lb63x: row.applicable_lb63x,
    issue_description: row.issue_description,
    ev_name: row.ev_name,
    projects_impacted: row.projects_impacted,
  }));

  return (
    <div>
      <PageHeader
        title="Faulty DTCs"
        description="DTC records flagged with data quality issues. Matched ECU data shown when available."
        actions={
          <Button variant="secondary" onClick={handleExport} disabled={exporting}>
            <span className="inline-flex items-center gap-2">
              <Download className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export to Excel"}
            </span>
          </Button>
        }
      />

      <VisualizationFilter>
        <FilterInput
          value={search}
          onChange={(value) => {
            setPage(1);
            setSearch(value);
          }}
          placeholder="Search symptom, code, text, EV..."
        />
        <SelectInput
          value={daCode}
          onChange={(value) => {
            setPage(1);
            setDaCode(value);
          }}
          options={[
            { value: "", label: "All DA" },
            ...daOptions.map((code) => ({
              value: code,
              label: formatDaLabel(code),
            })),
          ]}
        />
        <SelectInput
          value={issue}
          onChange={(value) => {
            setPage(1);
            setIssue(value);
          }}
          options={[
            { value: "", label: "All issues" },
            ...issueOptions.map((item) => ({ value: item, label: item })),
          ]}
        />
      </VisualizationFilter>

      <Card className="overflow-hidden p-0">
        <div className="border-card-border flex items-center justify-between border-b px-4 py-3">
          <p className="text-muted text-sm">
            {formatNumber(total)} faulty records
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
            showDa
            showErrorColumns
            onRowClick={(row) => {
              setModalDtc(row);
              setModalOpen(true);
            }}
            onEditGff={(row) => {
              setModalDtc(row);
              setModalOpen(true);
            }}
            emptyMessage="No records match the current filters."
          />
        </div>
      </Card>

      <DtcDetailModal
        dtc={modalDtc}
        ecuId={modalDtc?.ecu_id}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
