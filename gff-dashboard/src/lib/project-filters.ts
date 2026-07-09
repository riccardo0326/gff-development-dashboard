import type { VehicleProjectId } from "./types";

const ALLOWED_PROJECTS = new Set<VehicleProjectId>(["LB74x", "LB636", "LB63x"]);

export function parseProjectFilterParams(
  searchParams: URLSearchParams,
): VehicleProjectId[] {
  const fromRepeated = searchParams.getAll("project");
  const fromCsv = searchParams.get("projects")?.split(",") ?? [];
  const raw = fromRepeated.length > 0 ? fromRepeated : fromCsv;

  return raw.filter((value): value is VehicleProjectId =>
    ALLOWED_PROJECTS.has(value as VehicleProjectId),
  );
}

export function resolveVisibleProjects(
  allProjects: VehicleProjectId[],
  selected: VehicleProjectId[],
): VehicleProjectId[] {
  if (selected.length === 0) return allProjects;
  return allProjects.filter((project) => selected.includes(project));
}
