import type { VehicleProjectId } from "./types";

export function hasGffAvailable(value: string | null | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === "y";
}

export interface GffSlotRow {
  gff_available?: string | null;
  coverage_lb74x: string | null;
  coverage_lb636: string | null;
  coverage_lb63x: string | null;
  applicable_lb74x?: number;
  applicable_lb636?: number;
  applicable_lb63x?: number;
}

const PROJECT_COLUMNS: Record<
  VehicleProjectId,
  "coverage_lb74x" | "coverage_lb636" | "coverage_lb63x"
> = {
  LB74x: "coverage_lb74x",
  LB636: "coverage_lb636",
  LB63x: "coverage_lb63x",
};

const APPLICABLE_COLUMNS: Record<
  VehicleProjectId,
  "applicable_lb74x" | "applicable_lb636" | "applicable_lb63x"
> = {
  LB74x: "applicable_lb74x",
  LB636: "applicable_lb636",
  LB63x: "applicable_lb63x",
};

/** Applicable coverage cell for a vehicle project on a DTC row (one slot = one car per DTC). */
export function isCoverageSlot(
  row: GffSlotRow,
  project: VehicleProjectId,
): boolean {
  const coverageColumn = PROJECT_COLUMNS[project];
  const applicableColumn = APPLICABLE_COLUMNS[project];
  return !!(row[applicableColumn] ?? (row[coverageColumn] ? 1 : 0));
}

/** @deprecated Use isCoverageSlot — gff_available is metadata, not a slot gate. */
export function isTrackableGffSlot(
  row: GffSlotRow,
  project: VehicleProjectId,
): boolean {
  return isCoverageSlot(row, project);
}

/** True when the DTC still needs a GFF function developed (no y in column F). */
export function needsGffDevelopment(value: string | null | undefined): boolean {
  return !hasGffAvailable(value);
}

export type CoverageSlotState = "covered" | "pending" | "faulty";

const PROJECT_COVERAGE_COLUMNS: Record<
  VehicleProjectId,
  "coverage_lb74x" | "coverage_lb636" | "coverage_lb63x"
> = {
  LB74x: "coverage_lb74x",
  LB636: "coverage_lb636",
  LB63x: "coverage_lb63x",
};

export interface CoverageSlotRow extends GffSlotRow {
  dtc_id?: number;
}

/**
 * Resolve the exclusive coverage state for one applicable slot.
 * Listed faulty DTCs without a GFF count as faulty; with a GFF they count as covered.
 */
export function resolveCoverageSlotState(
  row: CoverageSlotRow,
  project: VehicleProjectId,
  faultyDtcIds?: Set<number>,
): CoverageSlotState | null {
  if (!isCoverageSlot(row, project)) return null;

  const isListedFaulty =
    row.dtc_id !== undefined && (faultyDtcIds?.has(row.dtc_id) ?? false);

  if (isListedFaulty) {
    return hasGffAvailable(row.gff_available) ? "covered" : "faulty";
  }

  const value = row[PROJECT_COVERAGE_COLUMNS[project]];
  return value === "covered" ? "covered" : "pending";
}
