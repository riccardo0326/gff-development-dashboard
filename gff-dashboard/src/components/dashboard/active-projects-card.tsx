"use client";

import type { VehicleProjectId } from "@/lib/types";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ActiveProject {
  id: VehicleProjectId;
  name: string;
}

export function ActiveProjectsCard({
  projects,
  className,
}: {
  projects: ActiveProject[];
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col justify-center", className)}>
      <p className="text-muted text-sm">Vehicle projects</p>
      {projects.length === 0 ? (
        <p className="text-muted mt-3 text-sm">No active projects</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {projects.map((project) => (
            <span
              key={project.id}
              className="border-accent/30 bg-accent/10 text-foreground inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium tracking-wide"
            >
              {project.name || project.id}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
