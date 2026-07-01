import { cn } from "@/lib/utils";

export interface ProgressBarSegments {
  covered: number;
  pending: number;
  neutral?: number;
  faulty?: number;
}

const SEGMENT_COLORS = {
  covered: "bg-[#22c55e]",
  pending: "bg-[#f59e0b]",
  neutral: "bg-[#64748b]",
  faulty: "bg-[#6b7280]",
} as const;

function SegmentedProgressBar({
  segments,
  className,
}: {
  segments: ProgressBarSegments;
  className?: string;
}) {
  const neutral = segments.neutral ?? 0;
  const faulty = segments.faulty ?? 0;
  const total = segments.covered + segments.pending + neutral + faulty;

  if (total === 0) {
    return (
      <div className={cn("bg-card-border h-2 overflow-hidden rounded-full", className)} />
    );
  }

  const parts: Array<{ key: keyof typeof SEGMENT_COLORS; count: number }> = [
    { key: "covered", count: segments.covered },
    { key: "pending", count: segments.pending },
    { key: "neutral", count: neutral },
    { key: "faulty", count: faulty },
  ];

  return (
    <div
      className={cn(
        "bg-card-border flex h-2 overflow-hidden rounded-full",
        className,
      )}
    >
      {parts.map(({ key, count }) =>
        count > 0 ? (
          <div
            key={key}
            className={cn("h-full transition-all", SEGMENT_COLORS[key])}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${key}: ${count}`}
          />
        ) : null,
      )}
    </div>
  );
}

export function ProgressBar({
  value,
  label,
  segments,
  className,
}: {
  value?: number;
  label?: string;
  segments?: ProgressBarSegments;
  className?: string;
}) {
  const pct =
    value !== undefined
      ? Math.max(0, Math.min(100, value * 100))
      : segments
        ? (() => {
            const neutral = segments.neutral ?? 0;
            const actionable =
              segments.covered + segments.pending + neutral;
            return actionable > 0 ? (segments.covered / actionable) * 100 : 0;
          })()
        : 0;

  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <div className="text-muted flex justify-between text-xs">
          <span>{label}</span>
          <span>{Number.isFinite(pct) ? pct.toFixed(1) : "0.0"}%</span>
        </div>
      ) : null}
      {segments ? (
        <SegmentedProgressBar segments={segments} />
      ) : (
        <div className="bg-card-border h-2 overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
