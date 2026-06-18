import { cn } from "@/lib/utils";
import type { CoverageStatus } from "@/lib/types";

const LABELS: Record<CoverageStatus, string> = {
  pending: "Pending",
  covered: "Covered",
};

const STYLES: Record<CoverageStatus, string> = {
  pending: "bg-warning/15 text-amber-200 ring-warning/30",
  covered: "bg-success/15 text-green-200 ring-success/30",
};

export function CoverageBadge({
  status,
}: {
  status: CoverageStatus | null | undefined;
}) {
  if (!status) {
    return (
      <span className="text-muted inline-flex rounded-full px-2 py-0.5 text-xs ring-1 ring-white/10 ring-inset">
        N/A
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STYLES[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
