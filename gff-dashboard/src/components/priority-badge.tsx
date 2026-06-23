import { cn } from "@/lib/utils";

const STYLES = {
  1: "bg-danger/20 text-red-300 ring-danger/30",
  2: "bg-warning/20 text-amber-200 ring-warning/30",
  3: "bg-accent-soft text-blue-200 ring-accent/30",
} as const;

export function PriorityBadge({
  priority,
  size = "sm",
}: {
  priority: number;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full font-semibold ring-1 ring-inset",
        size === "lg" ? "px-4 py-2 text-lg" : "px-2 py-0.5 text-xs font-medium",
        STYLES[priority as keyof typeof STYLES] ?? STYLES[3],
      )}
    >
      PRIO {priority}
    </span>
  );
}
