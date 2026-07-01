import { cn } from "@/lib/utils";

export function EmptyTableCell({
  children = "—",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-foreground/35 inline-block text-sm font-normal tabular-nums",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-card-border bg-card rounded-xl border p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted mt-1 max-w-3xl text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function FilterInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="border-card-border bg-background focus:border-accent w-full rounded-lg border px-3 py-2 text-sm outline-none"
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "border-card-border bg-background focus:border-accent w-full rounded-lg border px-3 py-2 text-sm outline-none",
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  href,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "secondary-muted";
  type?: "button" | "submit";
  disabled?: boolean;
  href?: string;
  className?: string;
}) {
  const styles = cn(
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors",
    variant === "primary" &&
      "bg-accent hover:bg-blue-500 text-white disabled:bg-[#1f293d] disabled:text-[#64748b] disabled:cursor-not-allowed disabled:hover:bg-[#1f293d]",
    variant === "secondary" &&
      "border border-[#30363d] bg-[#21262d] text-foreground hover:bg-white/5 disabled:border-[#30363d] disabled:bg-transparent disabled:text-[#64748b] disabled:cursor-not-allowed disabled:hover:bg-transparent",
    variant === "secondary-muted" &&
      "border border-[#30363d] bg-[#21262d] text-foreground hover:bg-white/5",
    className,
  );

  if (href) {
    return (
      <a href={href} className={styles}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={styles}>
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  tone = "info",
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  tone?: "info" | "success";
}) {
  const activeClass =
    tone === "success"
      ? "bg-[#238636] text-white"
      : "bg-[#1f6feb] text-white";

  return (
    <div
      className="inline-flex overflow-hidden rounded-lg border border-[#30363d]"
      role="group"
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3 py-1.5 text-sm capitalize transition-colors",
            index > 0 && "border-l border-[#30363d]",
            value === option.value
              ? activeClass
              : "bg-[#21262d] text-[#8b949e] hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PeriodSegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: React.ReactNode }>;
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-lg border border-[#30363d]"
      role="group"
    >
      {options.map((option, index) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3 py-1.5 text-sm transition-colors",
            index > 0 && "border-l border-[#30363d]",
            value === option.value
              ? "bg-[#30363d] text-white"
              : "bg-[#21262d] text-[#8b949e] hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
