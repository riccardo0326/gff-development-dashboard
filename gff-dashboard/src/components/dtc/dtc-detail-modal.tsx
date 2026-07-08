"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { CoverageBadge } from "@/components/coverage-badge";
import { Button } from "@/components/ui";
import type { CoverageStatus, VehicleProjectId } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  type DtcRowData,
  hasGffAvailable,
  projectCoverage,
} from "./dtc-types";

const PROJECTS: VehicleProjectId[] = ["LB74x", "LB636", "LB63x"];

interface DtcDetailModalProps {
  dtc: DtcRowData | null;
  ecuId?: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialEdit?: boolean;
}

export function DtcDetailModal({
  dtc,
  ecuId,
  open,
  onClose,
  onSaved,
  initialEdit = false,
}: DtcDetailModalProps) {
  const [editing, setEditing] = useState(initialEdit);
  const [saving, setSaving] = useState(false);
  const [gffAvailable, setGffAvailable] = useState(false);
  const [gffProgram, setGffProgram] = useState("");
  const [coverage, setCoverage] = useState<
    Record<VehicleProjectId, CoverageStatus | "">
  >({
    LB74x: "",
    LB636: "",
    LB63x: "",
  });

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!dtc) return;
    setEditing(initialEdit);
    setGffAvailable(hasGffAvailable(dtc.gff_available));
    setGffProgram(dtc.gff_program ?? "");
    setCoverage({
      LB74x: dtc.coverage_lb74x ?? "",
      LB636: dtc.coverage_lb636 ?? "",
      LB63x: dtc.coverage_lb63x ?? "",
    });
  }, [dtc, initialEdit, open]);

  if (!open || !dtc) return null;

  const resolvedEcuId = ecuId ?? dtc.ecu_id;
  const canEdit = Boolean(resolvedEcuId && dtc.id);

  async function handleSave() {
    if (!canEdit || !dtc?.id || !resolvedEcuId) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/ecus/${resolvedEcuId}/dtcs/${dtc.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gff_available: gffAvailable,
            gff_program: gffProgram || null,
            coverageUpdates: PROJECTS.flatMap((project) => {
              const { applicable, coverage: current } = projectCoverage(
                dtc,
                project,
              );
              if (!applicable) return [];
              const next = coverage[project];
              if (!next || next === current) return [];
              return [{ project, status: next as CoverageStatus }];
            }),
          }),
        },
      );

      if (!response.ok) {
        toast.error("Could not save changes");
        return;
      }

      toast.success("DTC updated");
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <div
        className="border-card-border bg-card max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dtc-modal-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 id="dtc-modal-title" className="text-lg font-semibold">
              DTC details
            </h3>
            <p className="text-muted mt-1 font-mono text-sm">
              {dtc.trouble_code ?? "—"} · {dtc.symptom ?? "—"}
            </p>
            {dtc.ecu_code ? (
              <p className="text-muted mt-1 text-xs">ECU {dtc.ecu_code}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground rounded-lg p-1 hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Symptom" value={dtc.symptom} />
          <Field label="Code" value={dtc.trouble_code} mono />
          <Field label="Text" value={dtc.dtc_text} className="sm:col-span-2" />
          {dtc.issue_description ? (
            <Field
              label="Issue"
              value={dtc.issue_description}
              className="sm:col-span-2"
            />
          ) : null}
        </div>

        <div className="mt-5 grid gap-4">
          <label
            className="flex items-center gap-2 text-sm"
            title="y = a GFF function already exists for this DTC; without y the GFF still needs to be developed"
          >
            <input
              type="checkbox"
              checked={gffAvailable}
              disabled={!editing || !canEdit}
              onChange={(e) => setGffAvailable(e.target.checked)}
              className="h-4 w-4"
            />
            GFF exists (y)
          </label>

          <EditableField
            label="GFF name (program)"
            value={gffProgram}
            editing={editing && canEdit}
            onChange={setGffProgram}
            multiline
          />
          <Field
            label="DTC error handling"
            value={dtc.error_handling}
            className="sm:col-span-2"
          />
          <Field
            label="DTC error setting conditions"
            value={dtc.error_setting_conditions}
            className="sm:col-span-2"
          />
        </div>

        <div className="mt-5">
          <p className="text-muted mb-2 text-xs tracking-wide uppercase">
            Project coverage
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {PROJECTS.map((project) => {
              const { applicable, coverage: current } = projectCoverage(
                dtc,
                project,
              );
              if (!applicable) {
                return (
                  <div
                    key={project}
                    className="border-card-border rounded-lg border p-3"
                  >
                    <p className="text-sm font-medium">{project}</p>
                    <p className="text-muted mt-1 text-xs">N/A</p>
                  </div>
                );
              }

              return (
                <div
                  key={project}
                  className="border-card-border rounded-lg border p-3"
                >
                  <p className="mb-2 text-sm font-medium">{project}</p>
                  {editing && canEdit ? (
                    <select
                      value={coverage[project] || current || "pending"}
                      onChange={(e) =>
                        setCoverage((prev) => ({
                          ...prev,
                          [project]: e.target.value as CoverageStatus,
                        }))
                      }
                      className="border-card-border bg-background w-full rounded-md border px-2 py-1 text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="covered">Covered</option>
                    </select>
                  ) : current ? (
                    <CoverageBadge status={current} />
                  ) : (
                    <span className="text-muted text-xs">Unset</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canEdit ? (
            editing ? (
              <Button disabled={saving} onClick={handleSave}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            ) : (
              <Button onClick={() => setEditing(true)}>Edit</Button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-muted text-xs uppercase">{label}</p>
      <p className={cn("mt-1 text-sm whitespace-pre-wrap", mono && "font-mono")}>
        {value ?? "—"}
      </p>
    </div>
  );
}

function EditableField({
  label,
  value,
  editing,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted text-xs uppercase">{label}</span>
      {editing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="border-card-border bg-background rounded-lg border px-3 py-2 text-sm"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="border-card-border bg-background rounded-lg border px-3 py-2 text-sm"
          />
        )
      ) : (
        <p className="whitespace-pre-wrap">{value || "—"}</p>
      )}
    </label>
  );
}
