import { AlertTriangle } from "lucide-react";

export function FaultyRowIndicator({ faulty }: { faulty?: boolean }) {
  if (!faulty) {
    return <span className="inline-block w-4 shrink-0" aria-hidden />;
  }

  return (
    <span
      className="text-warning inline-flex shrink-0"
      title="Faulty DTC"
      aria-label="Faulty DTC"
    >
      <AlertTriangle className="h-4 w-4" />
    </span>
  );
}
