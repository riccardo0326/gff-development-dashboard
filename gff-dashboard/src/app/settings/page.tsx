"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import {
  Button,
  Card,
  FilterInput,
  PageHeader,
} from "@/components/ui";
import type { Settings } from "@/lib/types";

interface ImportSummary {
  ecus: number;
  dtcs: number;
  faulty: number;
  daily: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setError("");
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const response = await fetch("/api/excel/export");
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `GFF_development_export_${new Date().toISOString().slice(0, 10)}.xlsm`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Workbook exported with macros and charts preserved.");
    } catch {
      setError("Could not export the workbook.");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(file: File) {
    setImporting(true);
    setError("");
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/excel/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        summary?: ImportSummary;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Import failed");
      }

      setMessage(
        `Import complete: ${payload.summary?.ecus ?? 0} ECUs, ${payload.summary?.dtcs ?? 0} DTCs, ${payload.summary?.faulty ?? 0} faulty rows.`,
      );
      window.location.reload();
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Could not import the workbook.",
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        description="Configure forecast parameters and manage workbook import/export."
      />

      {message ? (
        <Card>
          <p className="text-success text-sm">{message}</p>
        </Card>
      ) : null}
      {error ? (
        <Card>
          <p className="text-danger text-sm">{error}</p>
        </Card>
      ) : null}

      <Card>
        <h3 className="mb-2 font-medium">Workbook import / export</h3>
        <p className="text-muted mb-4 text-sm">
          Export generates an updated `.xlsm` from the template (macros and
          charts preserved). Import replaces all database content.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleExport} disabled={exporting}>
            <span className="inline-flex items-center gap-2">
              <Download className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export workbook"}
            </span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <span className="inline-flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {importing ? "Importing..." : "Import workbook"}
            </span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
        </div>
      </Card>

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
