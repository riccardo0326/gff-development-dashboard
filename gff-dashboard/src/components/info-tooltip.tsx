"use client";

import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

export function InfoTooltip({
  content,
  className,
  label = "More information",
}: {
  content: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      <button
        type="button"
        className="text-muted hover:text-foreground inline-flex rounded-full p-0.5 transition-colors"
        aria-label={label}
      >
        <CircleHelp className="h-4 w-4" />
      </button>
      <span
        role="tooltip"
        className="border-card-border bg-card text-foreground/90 pointer-events-none absolute top-full right-0 z-50 mt-2 hidden w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border p-3 text-left text-xs leading-relaxed shadow-xl group-hover:block group-focus-within:block"
      >
        {content}
      </span>
    </span>
  );
}
