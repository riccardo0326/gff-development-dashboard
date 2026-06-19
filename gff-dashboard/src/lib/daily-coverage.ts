import type { VehicleProjectId } from "./types";

export interface CoverageChange {
  id: number;
  dtc_id: number;
  ecu_id: string;
  project: VehicleProjectId;
  from_status: string;
  to_status: string;
  stat_date: string;
  changed_at: string;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isTrackableTransition(
  fromStatus: string | null,
  toStatus: string | null,
): boolean {
  return (
    (fromStatus === "pending" && toStatus === "covered") ||
    (fromStatus === "covered" && toStatus === "pending")
  );
}
