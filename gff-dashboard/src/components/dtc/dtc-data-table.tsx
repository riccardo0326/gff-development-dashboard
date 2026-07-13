"use client";

import { Pencil } from "lucide-react";
import { CoverageBadge } from "@/components/coverage-badge";
import { FaultyRowIndicator } from "@/components/faulty-row-indicator";
import { TruncateText } from "@/components/truncate-text";
import { cn } from "@/lib/utils";
import type { VehicleProjectId } from "@/lib/types";
import {
  type DtcRowData,
  hasGffAvailable,
  projectCoverage,
} from "./dtc-types";

const PROJECTS: VehicleProjectId[] = ["LB74x", "LB636", "LB63x"];

interface DtcDataTableProps {
  rows: DtcRowData[];
  loading?: boolean;
  showEcu?: boolean;
  showDa?: boolean;
  showErrorColumns?: boolean;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (dtcId: number, project: VehicleProjectId) => void;
  selectionProjects?: VehicleProjectId[];
  visibleProjects?: VehicleProjectId[];
  onRowClick: (row: DtcRowData) => void;
  onEditGff: (row: DtcRowData) => void;
  onGffToggle?: (row: DtcRowData, checked: boolean) => void;
  emptyMessage?: string;
}

function rowKey(dtcId: number, project: VehicleProjectId) {
  return `${dtcId}:${project}`;
}

function formatDaCode(code: string | null | undefined): string {
  if (!code) return "—";
  const normalized = code.replace(/^DA/i, "");
  return `DA${normalized}`;
}

export function DtcDataTable({
  rows,
  loading,
  showEcu,
  showDa,
  showErrorColumns = true,
  selectable,
  selected,
  onToggleSelect,
  selectionProjects,
  visibleProjects = PROJECTS,
  onRowClick,
  onEditGff,
  onGffToggle,
  emptyMessage = "No records found.",
}: DtcDataTableProps) {
  const colSpan =
    1 +
    (showDa ? 1 : 0) +
    (showEcu ? 2 : 0) +
    5 +
    (showErrorColumns && !showEcu ? 2 : 0) +
    visibleProjects.length;

  return (
    <table className="min-w-full text-sm">
      <thead className="border-card-border bg-white/5 border-b">
        <tr className="text-muted text-left">
          <th className="w-8 px-2 py-3" aria-label="Faulty" />
          {showDa ? <th className="px-3 py-3">DA</th> : null}
          {showEcu ? (
            <>
              <th className="px-3 py-3">ECU</th>
              <th className="px-3 py-3">Prio</th>
            </>
          ) : null}
          <th className="px-3 py-3">Symptom</th>
          <th className="px-3 py-3">Code</th>
          <th className="px-3 py-3">Text</th>
          <th className="px-3 py-3" title="y = a GFF function already exists for this DTC">
            GFF exists
          </th>
          <th className="px-3 py-3">GFF name</th>
          {!showEcu && showErrorColumns ? (
            <>
              <th className="px-3 py-3">Error handling</th>
              <th className="px-3 py-3">Setting conditions</th>
            </>
          ) : null}
          {visibleProjects.map((project) => (
            <th key={project} className="px-3 py-3">
              {project}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={colSpan} className="text-muted px-4 py-8 text-center">
              Loading...
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={colSpan} className="text-muted px-4 py-8 text-center">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={row.id ?? `${row.trouble_code}-${row.symptom}`}
              className={cn(
                "border-card-border hover:bg-accent-soft/40 cursor-pointer border-b align-top transition-colors last:border-b-0",
                row.is_faulty && "border-l-2 border-l-warning bg-warning/5",
              )}
              onClick={() => onRowClick(row)}
            >
              <td className="px-2 py-3">
                <FaultyRowIndicator faulty={row.is_faulty} />
              </td>
              {showDa ? (
                <td className="px-3 py-3 font-mono text-xs">
                  {formatDaCode(row.da_code ?? row.ecu_code)}
                </td>
              ) : null}
              {showEcu ? (
                <>
                  <td className="px-3 py-3">{row.ecu_code ?? "—"}</td>
                  <td className="px-3 py-3">{row.ecu_priority ?? "—"}</td>
                </>
              ) : null}
              <td className="px-3 py-3 font-mono text-xs">
                <TruncateText text={row.symptom} maxLength={16} />
              </td>
              <td className="px-3 py-3 font-mono text-xs">
                <TruncateText text={row.trouble_code} maxLength={16} />
              </td>
              <td className="px-3 py-3">
                <TruncateText text={row.dtc_text} />
              </td>
              <td
                className="px-3 py-3"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={hasGffAvailable(row.gff_available)}
                  disabled={!onGffToggle || !row.id}
                  onChange={(e) => onGffToggle?.(row, e.target.checked)}
                  className="h-4 w-4"
                  title="y = a GFF function already exists for this DTC"
                />
              </td>
              <td
                className="px-3 py-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-2">
                  <TruncateText text={row.gff_program} maxLength={24} />
                  {row.id ? (
                    <button
                      type="button"
                      onClick={() => onEditGff(row)}
                      className="text-muted hover:text-foreground shrink-0 rounded p-1 hover:bg-white/10"
                      title="Edit GFF fields"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </td>
              {!showEcu && showErrorColumns ? (
                <>
                  <td className="px-3 py-3">
                    <TruncateText text={row.error_handling} />
                  </td>
                  <td className="px-3 py-3">
                    <TruncateText text={row.error_setting_conditions} />
                  </td>
                </>
              ) : null}
              {visibleProjects.map((projectName) => {
                const { coverage, applicable } = projectCoverage(
                  row,
                  projectName,
                );
                const showSelection =
                  selectable &&
                  applicable &&
                  (!selectionProjects?.length ||
                    selectionProjects.includes(projectName));

                return (
                  <td
                    key={projectName}
                    className="px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!applicable ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {showSelection && row.id ? (
                          <input
                            type="checkbox"
                            checked={selected?.has(rowKey(row.id, projectName))}
                            onChange={() =>
                              onToggleSelect?.(row.id!, projectName)
                            }
                            className="h-4 w-4"
                          />
                        ) : null}
                        {coverage ? (
                          <CoverageBadge status={coverage} />
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
  );
}

export { rowKey as dtcSelectionKey, PROJECTS as DTC_PROJECTS };
