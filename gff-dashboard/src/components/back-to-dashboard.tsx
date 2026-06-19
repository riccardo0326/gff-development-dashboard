import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function BackToDashboard({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "text-muted hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Dashboard</span>
    </Link>
  );
}
