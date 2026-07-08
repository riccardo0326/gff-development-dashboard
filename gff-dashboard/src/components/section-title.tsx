import { cn } from "@/lib/utils";

export function SectionTitle({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="text-muted mt-1 max-w-3xl text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
