"use client";

type TooltipEntry = {
  name?: string;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
};

export function DarkChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#1f242c] px-3 py-2 shadow-lg">
      {label !== undefined && label !== null ? (
        <p className="mb-1.5 text-xs font-medium text-[#8b949e]">{label}</p>
      ) : null}
      <div className="space-y-1">
        {payload.map((entry) => {
          const name = String(entry.name ?? entry.dataKey ?? "");
          const seriesColor =
            name.includes("benchmark") || name.includes("average")
              ? "#4ade80"
              : "#ffffff";
          return (
            <p key={name} className="text-sm" style={{ color: seriesColor }}>
              {name}: {entry.value}
            </p>
          );
        })}
      </div>
    </div>
  );
}
