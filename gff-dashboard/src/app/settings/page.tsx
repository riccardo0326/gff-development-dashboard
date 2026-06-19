"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  FilterInput,
  PageHeader,
} from "@/components/ui";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then(setSettings);
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
        description="Configure forecast parameters used in statistics."
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
    </div>
  );
}
