"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FaultyFilterToggle({
  active,
  onChange,
}: {
  active: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-warning bg-warning/15 text-warning"
          : "border-card-border bg-background text-muted hover:border-warning/40 hover:text-foreground",
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      Faulty only
    </button>
  );
}
