"use client";

import { useEffect, useState } from "react";
import { BackToDashboard } from "@/components/back-to-dashboard";
import {
  Button,
  Card,
  FilterInput,
  PageHeader,
} from "@/components/ui";
import type { DailyStat } from "@/lib/types";
import { formatDisplayDate } from "@/lib/calculations";
import { formatNumber } from "@/lib/utils";

export default function DailyGffsPage() {
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [statDate, setStatDate] = useState("");
  const [implForDay, setImplForDay] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadDailyStats() {
    setLoading(true);
    const response = await fetch("/api/daily-stats");
    setDailyStats(await response.json());
    setLoading(false);
  }

  useEffect(() => {
    loadDailyStats();
  }, []);

  async function addDailyEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!statDate || !implForDay) return;

    const response = await fetch("/api/daily-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stat_date: statDate,
        impl_for_day: Number(implForDay),
      }),
    });

    if (!response.ok) {
      setMessage("Could not save the daily entry.");
      return;
    }

    setStatDate("");
    setImplForDay("");
    setMessage("Daily GFF count saved.");
    await loadDailyStats();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add daily GFFs"
        description="Record how many DTCs were covered today. This feeds the statistics trend and forecast."
        actions={<BackToDashboard />}
      />

      {message ? (
        <Card>
          <p className="text-success text-sm">{message}</p>
        </Card>
      ) : null}

      <Card>
        <form onSubmit={addDailyEntry} className="grid max-w-xl gap-4">
          <h3 className="font-medium">Daily covered count</h3>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Date</span>
            <input
              type="date"
              value={statDate}
              onChange={(e) => setStatDate(e.target.value)}
              className="border-card-border bg-background rounded-lg border px-3 py-2"
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">GFFs covered for day</span>
            <FilterInput
              value={implForDay}
              onChange={setImplForDay}
              placeholder="e.g. 95"
            />
          </label>
          <Button type="submit">Save daily count</Button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <h3 className="mb-4 font-medium">Recent daily entries</h3>
        {loading ? (
          <p className="text-muted text-sm">Loading entries...</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-muted border-card-border border-b text-left">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Covered total</th>
                <th className="px-2 py-2">Covered for day</th>
              </tr>
            </thead>
            <tbody>
              {[...dailyStats].reverse().map((row) => (
                <tr
                  key={row.id}
                  className="border-card-border border-b last:border-b-0"
                >
                  <td className="px-2 py-2">
                    {formatDisplayDate(row.stat_date)}
                  </td>
                  <td className="px-2 py-2">
                    {formatNumber(row.implemented_count)}
                  </td>
                  <td className="px-2 py-2">{formatNumber(row.impl_for_day)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
