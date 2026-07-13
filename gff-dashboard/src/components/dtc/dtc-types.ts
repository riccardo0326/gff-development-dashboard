import type { CoverageStatus, VehicleProjectId } from "@/lib/types";

export interface DtcRowData {
  id?: number;
  ecu_id?: string;
  ecu_code?: string;
  da_code?: string | null;
  ecu_priority?: number;
  symptom: string | null;
  trouble_code: string | null;
  dtc_text: string | null;
  error_handling: string | null;
  error_setting_conditions: string | null;
  gff_available: string | null;
  gff_program: string | null;
  coverage_lb74x: CoverageStatus | null;
  coverage_lb636: CoverageStatus | null;
  coverage_lb63x: CoverageStatus | null;
  applicable_lb74x?: number;
  applicable_lb636?: number;
  applicable_lb63x?: number;
  issue_description?: string | null;
  ev_name?: string | null;
  projects_impacted?: string | null;
  is_faulty?: boolean;
}

export { hasGffAvailable } from "@/lib/gff";

export function projectCoverage(
  row: DtcRowData,
  project: VehicleProjectId,
): { coverage: CoverageStatus | null; applicable: boolean } {
  if (project === "LB74x") {
    return {
      coverage: row.coverage_lb74x,
      applicable: !!row.applicable_lb74x,
    };
  }
  if (project === "LB636") {
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
