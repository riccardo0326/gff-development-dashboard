"use client";

import type { VehicleProjectId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { resolveVisibleProjects } from "@/lib/project-filters";

export { resolveVisibleProjects };

export function ProjectMultiSelect({
  projects,
  selected,
  onChange,
  className,
}: {
  projects: VehicleProjectId[];
  selected: VehicleProjectId[];
  onChange: (selected: VehicleProjectId[]) => void;
  className?: string;
}) {
  function toggle(project: VehicleProjectId) {
    if (selected.includes(project)) {
      onChange(selected.filter((item) => item !== project));
      return;
    }
    onChange([...selected, project]);
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      <span className="text-muted text-sm">Projects</span>
      <div className="flex flex-wrap gap-2">
        {projects.map((project) => {
          const active =
            selected.length === 0 || selected.includes(project);
          const explicitlySelected = selected.includes(project);

          return (
            <button
              key={project}
              type="button"
              onClick={() => toggle(project)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                selected.length === 0 || explicitlySelected
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-card-border bg-background text-muted opacity-60 hover:bg-white/5 hover:opacity-100",
              )}
              aria-pressed={explicitlySelected}
            >
              {project}
            </button>
          );
        })}
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-muted hover:text-foreground px-2 py-1.5 text-xs underline-offset-2 hover:underline"
          >
            Show all
          </button>
        ) : null}
      </div>
    </div>
  );
}
