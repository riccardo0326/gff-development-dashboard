"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, SelectInput } from "@/components/ui";
import { formatNumber } from "@/lib/utils";

interface ActivityItem {
  kind: "coverage_change" | "audit_event";
  id: number;
  timestamp: string;
  username: string | null;
  summary: string;
  eventType?: string;
  details: Record<string, unknown> | null;
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "50",
    });
    if (eventType) params.set("eventType", eventType);

    setLoading(true);
    fetch(`/api/audit?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, eventType]);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="Coverage changes, bulk updates, imports, exports, and report downloads."
      />

      <Card className="max-w-xs">
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
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-card-border border-b px-4 py-3">
          <p className="text-muted text-sm">
            {formatNumber(total)} events
          </p>
        </div>
        {loading ? (
          <p className="text-muted px-4 py-8 text-sm">Loading activity...</p>
        ) : items.length === 0 ? (
          <p className="text-muted px-4 py-8 text-sm">No activity yet.</p>
        ) : (
          <ul className="divide-card-border divide-y">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm">{item.summary}</p>
                    <p className="text-muted mt-1 text-xs">
                      {item.kind === "audit_event" ? (
                        <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 uppercase">
                          {item.eventType}
                        </span>
                      ) : (
                        <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5">
                          change
                        </span>
                      )}
                      {item.username ? `@${item.username}` : "system"} ·{" "}
                      {item.timestamp.replace("T", " ").slice(0, 19)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
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
