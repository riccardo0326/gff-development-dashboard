import { cn } from "@/lib/utils";

const STYLES = {
  1: "bg-danger/20 text-red-300 ring-danger/30",
  2: "bg-warning/20 text-amber-200 ring-warning/30",
  3: "bg-accent-soft text-blue-200 ring-accent/30",
} as const;

export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STYLES[priority as keyof typeof STYLES] ?? STYLES[3],
      )}
    >
      PRIO {priority}
    </span>
  );
}
