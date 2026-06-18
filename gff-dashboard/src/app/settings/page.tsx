"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  FilterInput,
  PageHeader,
} from "@/components/ui";
import type { DailyStat, Settings } from "@/lib/types";
import { formatDisplayDate } from "@/lib/calculations";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [statDate, setStatDate] = useState("");
  const [implForDay, setImplForDay] = useState("");
  const [message, setMessage] = useState("");

  async function loadAll() {
    const [settingsRes, dailyRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/daily-stats"),
    ]);
    setSettings(await settingsRes.json());
    setDailyStats(await dailyRes.json());
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;

    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setMessage("Settings saved.");
  }

  async function addDailyEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!statDate || !implForDay) return;

    await fetch("/api/daily-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stat_date: statDate,
        impl_for_day: Number(implForDay),
      }),
    });

    setStatDate("");
    setImplForDay("");
    setMessage("Daily entry added.");
    await loadAll();
  }

  if (!settings) {
    return (
      <div>
        <PageHeader title="Settings" />
        <Card>
          <p className="text-muted text-sm">Loading settings...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure forecast parameters and add manual daily covered-DTC entries."
      />

      {message ? (
        <Card>
          <p className="text-success text-sm">{message}</p>
        </Card>
      ) : null}

      <Card>
        <form onSubmit={saveSettings} className="grid max-w-xl gap-4">
          <h3 className="font-medium">Forecast parameters</h3>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Daily estimate</span>
            <FilterInput
              value={String(settings.daily_estimate)}
              onChange={(value) =>
                setSettings({ ...settings, daily_estimate: Number(value) || 0 })
              }
              placeholder="50"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Forecast start date</span>
            <input
              type="date"
              value={settings.forecast_start_date}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  forecast_start_date: e.target.value,
                })
              }
              className="border-card-border bg-background rounded-lg border px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Baseline covered DTCs</span>
            <FilterInput
              value={String(settings.baseline_implemented)}
              onChange={(value) =>
                setSettings({
                  ...settings,
                  baseline_implemented: Number(value) || 0,
                })
              }
              placeholder="22167"
            />
          </label>
          <Button type="submit">Save settings</Button>
        </form>
      </Card>

      <Card>
        <form onSubmit={addDailyEntry} className="grid max-w-xl gap-4">
          <h3 className="font-medium">Add daily covered count</h3>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Date</span>
            <input
              type="date"
              value={statDate}
              onChange={(e) => setStatDate(e.target.value)}
              className="border-card-border bg-background rounded-lg border px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Covered for day</span>
            <FilterInput
              value={implForDay}
              onChange={setImplForDay}
              placeholder="e.g. 95"
            />
          </label>
          <Button type="submit">Add daily entry</Button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <h3 className="mb-4 font-medium">Existing daily entries</h3>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-muted border-card-border border-b text-left">
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Covered total</th>
              <th className="px-2 py-2">Covered for day</th>
            </tr>
          </thead>
          <tbody>
            {dailyStats.map((row) => (
              <tr key={row.id} className="border-card-border border-b last:border-b-0">
                <td className="px-2 py-2">{formatDisplayDate(row.stat_date)}</td>
                <td className="px-2 py-2">{row.implemented_count}</td>
                <td className="px-2 py-2">{row.impl_for_day}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
