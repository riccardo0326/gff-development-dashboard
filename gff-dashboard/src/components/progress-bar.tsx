import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value * 100));

  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <div className="text-muted flex justify-between text-xs">
          <span>{label}</span>
          <span>{pct.toFixed(1)}%</span>
        </div>
      ) : null}
      <div className="bg-card-border h-2 overflow-hidden rounded-full">
        <div
          className="bg-accent h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
