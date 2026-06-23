"use client";

import { cn } from "@/lib/utils";

export function TruncateText({
  text,
  maxLength = 48,
  className,
}: {
  text: string | null | undefined;
  maxLength?: number;
  className?: string;
}) {
  if (!text) {
    return <span className={cn("text-muted", className)}>—</span>;
  }

  const truncated = text.length > maxLength;
  const display = truncated ? `${text.slice(0, maxLength)}…` : text;

  return (
    <span className={cn("block max-w-[200px] truncate", className)} title={text}>
      {display}
    </span>
  );
}
