export type CoverageStatus = "pending" | "covered";

export type VehicleProjectId = "LB74x" | "LB636" | "LB63x";

export const VEHICLE_PROJECTS: VehicleProjectId[] = ["LB74x", "LB636", "LB63x"];

export interface Ecu {
  id: string;
  code: string;
  priority: number;
  lb74x_applicable: number;
  lb636_applicable: number;
  lb63x_applicable: number;
  odx_lb74x: string | null;
  odx_lb636: string | null;
  odx_lb63x: string | null;
}

export interface Dtc {
  id: number;
  ecu_id: string;
  symptom: string | null;
  trouble_code: string | null;
  dtc_text: string | null;
  error_handling: string | null;
  error_setting_conditions: string | null;
  gff_program: string | null;
  category: number | null;
  label: number | null;
  coverage_lb74x: CoverageStatus | null;
  coverage_lb636: CoverageStatus | null;
  coverage_lb63x: CoverageStatus | null;
  applicable_lb74x?: number;
  applicable_lb636?: number;
  applicable_lb63x?: number;
}

export interface FaultyDtc {
  id: number;
  symptom: string | null;
  trouble_code: string | null;
  dtc_text: string | null;
  issue_description: string | null;
  ev_name: string | null;
  da_code: string | null;
  projects_impacted: string | null;
}

export interface DailyStat {
  id: number;
  stat_date: string;
  implemented_count: number;
  impl_for_day: number;
  impl_for_day_auto?: number;
  impl_for_day_manual?: number;
}

export interface Settings {
  daily_estimate: number;
  forecast_start_date: string;
  baseline_implemented: number;
}

export interface ProjectCompletion {
  project: VehicleProjectId;
  total: number;
  covered: number;
  pending: number;
  completion_pct: number;
}

export interface EcuCompletion extends Ecu {
  projects: Record<VehicleProjectId, ProjectCompletion | null>;
}

export interface PriorityStats {
  label: string;
  priority: number | null;
  total_dtcs: number;
  implemented: number;
  pending: number;
  daily_estimate: number | null;
  daily_average: number | null;
  days_required_estimated: number | null;
  end_date_estimated: string | null;
  days_required_average: number | null;
  end_date_average: string | null;
  completion: Record<VehicleProjectId, number>;
}
