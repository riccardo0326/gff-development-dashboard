"use client";

import { useEffect, useMemo, useState } from "react";
import { ProgressBar } from "@/components/progress-bar";
import { Card, SegmentedControl } from "@/components/ui";
import type { ProjectSegments, VehicleProjectId } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/utils";

export function ProjectProgressPanel({
  projects,
  segments,
  completion,
  includeFaultyInBar,
}: {
  projects: VehicleProjectId[];
  segments: Record<VehicleProjectId, ProjectSegments>;
  completion: Record<VehicleProjectId, number>;
  includeFaultyInBar: boolean;
}) {
  const activeProjects = useMemo(
    () =>
      projects.filter((project) => {
        const slice = segments[project];
        if (!slice) return false;
        const total = includeFaultyInBar
          ? slice.covered + slice.pending + slice.faulty
          : slice.covered + slice.pending;
        return total > 0;
      }),
    [projects, segments, includeFaultyInBar],
  );

  const [selectedProject, setSelectedProject] = useState<VehicleProjectId | "">(
    "",
  );

  useEffect(() => {
    if (activeProjects.length === 0) {
      setSelectedProject("");
      return;
    }
    if (!selectedProject || !activeProjects.includes(selectedProject)) {
      setSelectedProject(activeProjects[0]);
    }
  }, [activeProjects, selectedProject]);

  if (activeProjects.length === 0 || !selectedProject) {
    return (
      <Card className="bg-background/40">
        <p className="text-muted text-sm">No project data for this scope.</p>
      </Card>
    );
  }

  const slice = segments[selectedProject];
  const barSegments = includeFaultyInBar
    ? slice
    : { covered: slice.covered, pending: slice.pending, faulty: 0 };

  return (
    <div className="space-y-3">
      <SegmentedControl
        tone="info"
        value={selectedProject}
        onChange={setSelectedProject}
        options={activeProjects.map((project) => ({
          value: project,
          label: project,
        }))}
      />
      <Card className="bg-background/40">
        <p className="mb-2 text-sm font-medium">{selectedProject}</p>
        <ProgressBar
          value={completion[selectedProject]}
          segments={barSegments}
        />
        <p className="text-muted mt-2 text-xs">
          {formatPercent(completion[selectedProject])} completion
          {includeFaultyInBar && slice.faulty > 0
            ? ` · ${formatNumber(slice.faulty)} faulty`
            : ""}
        </p>
      </Card>
    </div>
  );
}
