import type { VehicleProjectId } from "@/lib/types";

const VI_PROJECT_MAP: Record<string, VehicleProjectId> = {
  VI_LB634: "LB636",
  VI_LB636: "LB636",
  VI_LB63X: "LB63x",
  VI_LB63x: "LB63x",
  VI_LB74X: "LB74x",
  VI_LB74x: "LB74x",
};

export function vehicleProjectFromViId(viId: string): VehicleProjectId | null {
  const normalized = viId.trim();
  const direct = VI_PROJECT_MAP[normalized] ?? VI_PROJECT_MAP[normalized.toUpperCase()];
  if (direct) return direct;

  const upper = normalized.toUpperCase();
  if (upper.includes("LB634") || upper.includes("LB636")) return "LB636";
  if (upper.includes("LB63")) return "LB63x";
  if (upper.includes("LB74")) return "LB74x";
  return null;
}

export function odxColumnForProject(
  project: VehicleProjectId,
): "odx_lb74x" | "odx_lb636" | "odx_lb63x" {
  switch (project) {
    case "LB74x":
      return "odx_lb74x";
    case "LB636":
      return "odx_lb636";
    case "LB63x":
      return "odx_lb63x";
  }
}

export function applicableColumnForProject(
  project: VehicleProjectId,
): "applicable_lb74x" | "applicable_lb636" | "applicable_lb63x" {
  switch (project) {
    case "LB74x":
      return "applicable_lb74x";
    case "LB636":
      return "applicable_lb636";
    case "LB63x":
      return "applicable_lb63x";
  }
}

export function coverageColumnForProject(
  project: VehicleProjectId,
): "coverage_lb74x" | "coverage_lb636" | "coverage_lb63x" {
  switch (project) {
    case "LB74x":
      return "coverage_lb74x";
    case "LB636":
      return "coverage_lb636";
    case "LB63x":
      return "coverage_lb63x";
  }
}
