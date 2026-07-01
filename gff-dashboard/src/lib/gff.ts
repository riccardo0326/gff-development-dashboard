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

/** Applicable project slot where a GFF can be created/tracked for the DTC. */
export function isTrackableGffSlot(
  row: GffSlotRow,
  project: VehicleProjectId,
): boolean {
  const coverageColumn = PROJECT_COLUMNS[project];
  const applicableColumn = APPLICABLE_COLUMNS[project];
  const applicable = row[applicableColumn] ?? (row[coverageColumn] ? 1 : 0);
  if (!applicable) return false;
  return hasGffAvailable(row.gff_available);
}
