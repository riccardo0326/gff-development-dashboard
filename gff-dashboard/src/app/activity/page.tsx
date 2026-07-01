"use client";

import { useEffect, useState } from "react";
import { CalendarRange, ChevronDown, ChevronRight } from "lucide-react";
import { Button, Card, PageHeader, PeriodSegmentedControl, SelectInput } from "@/components/ui";
import {
  dateRangeForShortcut,
  formatDateInRome,
  todayIsoDate,
} from "@/lib/datetime";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

type DateShortcut = "" | "day" | "week" | "month" | "custom";

interface CoverageChangeActivity {
  kind: "coverage_change";
  id: number;
  timestamp: string;
  username: string | null;
  summary: string;
}

interface AuditEventActivity {
  kind: "audit_event";
  id: number;
  timestamp: string;
  username: string | null;
  summary: string;
  eventType: string;
}

interface BulkUpdateActivity {
  kind: "bulk_update";
  id: number;
  timestamp: string;
  username: string | null;
  summary: string;
  eventType: "bulk_update";
  children: CoverageChangeActivity[];
}

type ActivityItem =
  | CoverageChangeActivity
  | AuditEventActivity
  | BulkUpdateActivity;

function activityBadgeClass(kind: string, eventType?: string): string {
  if (kind === "bulk_update") {
    return "border border-purple-500/30 bg-purple-500/15 text-purple-200";
  }
  if (eventType === "import") {
    return "border border-blue-500/30 bg-blue-500/15 text-blue-200";
  }
  if (eventType === "export") {
    return "border border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
  }
  if (eventType === "report") {
    return "border border-amber-500/30 bg-amber-500/15 text-amber-200";
  }
  return "border border-[#30363d] bg-[#21262d] text-[#8b949e]";
}

function ActivityMeta({
  item,
}: {
  item: {
    kind: string;
    eventType?: string;
    username: string | null;
    timestamp: string;
  };
}) {
  const badgeLabel =
    item.kind === "bulk_update"
      ? "bulk_update"
      : item.kind === "audit_event"
        ? item.eventType
        : "change";

  return (
    <p className="mt-1 text-xs text-[#8b949e]">
      <span
        className={cn(
          "mr-2 inline-block rounded px-1.5 py-0.5 uppercase",
          activityBadgeClass(item.kind, item.eventType),
        )}
      >
        {badgeLabel}
      </span>
      {item.username ? `@${item.username}` : "system"} ·{" "}
      {formatDateInRome(item.timestamp)}
    </p>
  );
}

function ActivityIconSlot({ children }: { children?: React.ReactNode }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center">
      {children ?? (
        <span className="bg-foreground/30 h-1.5 w-1.5 rounded-full" aria-hidden />
      )}
    </span>
  );
}

function BulkUpdateRow({ item }: { item: BulkUpdateActivity }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-2 text-left"
      >
        <ActivityIconSlot>
          {open ? (
            <ChevronDown className="text-muted h-4 w-4" />
          ) : (
            <ChevronRight className="text-muted h-4 w-4" />
          )}
        </ActivityIconSlot>
        <div className="min-w-0 flex-1">
          <p className="text-sm">{item.summary}</p>
          <ActivityMeta item={item} />
          {open && item.children.length > 0 ? (
            <ul className="border-card-border mt-3 space-y-2 border-l pl-4">
              {item.children.map((child) => (
                <li key={child.id} className="text-sm">
                  <p>{child.summary}</p>
                  <p className="text-muted mt-0.5 text-xs text-[#8b949e]">
                    <span className="mr-2 inline-block rounded border border-[#30363d] bg-[#21262d] px-1.5 py-0.5 text-[#8b949e]">
                      change
                    </span>
                    {child.username ? `@${child.username}` : "system"} ·{" "}
                    {formatDateInRome(child.timestamp)}
                  </p>
                </li>
              ))}
            </ul>
          ) : open ? (
            <p className="text-muted mt-2 text-xs">No individual changes recorded.</p>
          ) : null}
        </div>
      </button>
    </li>
  );
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState("");
  const [role, setRole] = useState("");
  const [dateShortcut, setDateShortcut] = useState<DateShortcut>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  function applyShortcut(shortcut: Exclude<DateShortcut, "" | "custom">) {
    const range = dateRangeForShortcut(shortcut);
    setDateShortcut(shortcut);
    setFromDate(range.from);
    setToDate(range.to);
    setCalendarOpen(false);
    setPage(1);
  }

  function clearDateFilter() {
    setDateShortcut("");
    setFromDate("");
    setToDate("");
    setCalendarOpen(false);
    setPage(1);
  }

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "50",
    });
    if (eventType) params.set("eventType", eventType);
    if (role) params.set("role", role);
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);

    setLoading(true);
    fetch(`/api/audit?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, eventType, role, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="Coverage changes, bulk updates, imports, exports, and report downloads."
      />

      <Card className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectInput
            value={eventType}
            onChange={(value) => {
              setPage(1);
              setEventType(value);
            }}
            options={[
              { value: "", label: "All events" },
              { value: "coverage_change", label: "Coverage changes" },
              { value: "bulk_update", label: "Bulk updates" },
              { value: "import", label: "Imports" },
              { value: "export", label: "Exports" },
              { value: "report", label: "Reports" },
            ]}
          />
          <SelectInput
            value={role}
            onChange={(value) => {
              setPage(1);
              setRole(value);
            }}
            options={[
              { value: "", label: "All roles" },
              { value: "admin", label: "Admin" },
              { value: "user", label: "User" },
              { value: "lambo", label: "Lambo" },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted text-xs font-medium uppercase tracking-wide">
            Period
          </span>
          <PeriodSegmentedControl
            value={
              dateShortcut === "day" ||
              dateShortcut === "week" ||
              dateShortcut === "month"
                ? dateShortcut
                : null
            }
            onChange={(value) =>
              applyShortcut(value as Exclude<DateShortcut, "" | "custom">)
            }
            options={[
              { value: "day", label: "Last day" },
              { value: "week", label: "Last week" },
              { value: "month", label: "Last month" },
            ]}
          />
          <Button
            variant={dateShortcut === "custom" ? "primary" : "secondary"}
            onClick={() => {
              setCalendarOpen((open) => !open);
              if (!fromDate && !toDate) {
                setFromDate(todayIsoDate());
                setToDate(todayIsoDate());
              }
              setDateShortcut("custom");
            }}
          >
            <span className="inline-flex items-center gap-2">
              <CalendarRange className="h-4 w-4" />
              Custom range
            </span>
          </Button>
          {fromDate || toDate ? (
            <button
              type="button"
              onClick={clearDateFilter}
              className="text-muted hover:text-foreground text-sm underline-offset-2 hover:underline"
            >
              Clear dates
            </button>
          ) : null}
        </div>

        {calendarOpen ? (
          <div className="border-card-border grid max-w-xl gap-3 rounded-lg border p-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setDateShortcut("custom");
                  setPage(1);
                }}
                className="border-card-border bg-background rounded-lg border px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setDateShortcut("custom");
                  setPage(1);
                }}
                className="border-card-border bg-background rounded-lg border px-3 py-2"
              />
            </label>
          </div>
        ) : null}

        {fromDate && toDate ? (
          <p className="text-muted text-xs">
            Showing events from {fromDate} to {toDate} (Europe/Rome)
          </p>
        ) : null}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-card-border border-b px-4 py-3">
          <p className="text-muted text-sm">{formatNumber(total)} events</p>
        </div>
        {loading ? (
          <p className="text-muted px-4 py-8 text-sm">Loading activity...</p>
        ) : items.length === 0 ? (
          <p className="text-muted px-4 py-8 text-sm">No activity yet.</p>
        ) : (
          <ul className="divide-card-border divide-y">
            {items.map((item) =>
              item.kind === "bulk_update" ? (
                <BulkUpdateRow key={`bulk-${item.id}`} item={item} />
              ) : (
                <li key={`${item.kind}-${item.id}`} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <ActivityIconSlot />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{item.summary}</p>
                      <ActivityMeta item={item} />
                    </div>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
        <div className="border-card-border flex items-center justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="border-card-border rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-muted text-sm">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="border-card-border rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </Card>
    </div>
  );
}
