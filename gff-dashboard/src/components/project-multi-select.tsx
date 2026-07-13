"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { VehicleProjectId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { resolveVisibleProjects } from "@/lib/project-filters";

export { resolveVisibleProjects };

function formatSelectionLabel(
  selected: VehicleProjectId[],
  projects: VehicleProjectId[],
): string {
  if (selected.length === 0) return "All projects";
  if (selected.length === projects.length) return "All projects";
  if (selected.length === 1) return selected[0];
  return selected.join(", ");
}

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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function toggle(project: VehicleProjectId) {
    if (selected.includes(project)) {
      onChange(selected.filter((item) => item !== project));
      return;
    }
    onChange([...selected, project]);
  }

  const label = formatSelectionLabel(selected, projects);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="border-card-border bg-background focus:border-accent flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("truncate", selected.length === 0 && "text-muted")}>
          {label}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 opacity-60 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          className="border-card-border bg-card absolute z-20 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
          role="listbox"
          aria-multiselectable
        >
          {projects.map((project) => (
            <label
              key={project}
              className="hover:bg-white/5 flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(project)}
                onChange={() => toggle(project)}
                className="h-4 w-4"
              />
              {project}
            </label>
          ))}
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                onChange([]);
                setOpen(false);
              }}
              className="text-muted hover:text-foreground border-card-border w-full border-t px-3 py-2 text-left text-xs hover:bg-white/5"
            >
              Clear selection
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
