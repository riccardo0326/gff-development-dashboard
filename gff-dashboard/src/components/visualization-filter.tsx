import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export function VisualizationFilter({
  children,
  className,
  columns = 3,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  const gridClass =
    columns === 2
      ? "md:grid-cols-2"
      : columns === 4
        ? "lg:grid-cols-4"
        : "lg:grid-cols-3";

  return (
    <Card className={cn("mb-6", className)}>
      <h3 className="mb-3 font-medium">Visualization filter</h3>
      <div className={cn("grid gap-3", gridClass)}>{children}</div>
    </Card>
  );
}
