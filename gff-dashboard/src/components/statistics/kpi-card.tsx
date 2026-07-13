import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "success" | "warning" | "accent";
}) {
  return (
    <Card
      className={cn(
        accent === "success" && "border-success/20",
        accent === "warning" && "border-warning/20",
        accent === "accent" && "border-accent/20",
      )}
    >
      <p className="text-foreground/80 text-sm font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {hint ? (
        <p className="text-foreground/60 mt-1 text-xs">{hint}</p>
      ) : null}
    </Card>
  );
}
