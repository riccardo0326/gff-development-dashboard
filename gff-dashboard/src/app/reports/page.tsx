"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button, Card, PageHeader } from "@/components/ui";

type Period = "weekly" | "monthly";

export default function ReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function downloadReport(period: Period, format: "xlsx" | "pdf") {
    const key = `${period}-${format}`;
    setDownloading(key);
    try {
      const response = await fetch(
        `/api/reports/${period}/${format}`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const ext = format === "xlsx" ? "xlsx" : "pdf";
      anchor.download = `GFF_${period}_report_${new Date().toISOString().slice(0, 10)}.${ext}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not generate the report.");
    } finally {
      setDownloading(null);
    }
  }

  function ReportCard({
    period,
    title,
    description,
  }: {
    period: Period;
    title: string;
    description: string;
  }) {
    return (
      <Card>
        <h3 className="font-medium">{title}</h3>
        <p className="text-muted mt-1 mb-4 text-sm">{description}</p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={downloading !== null}
            onClick={() => downloadReport(period, "xlsx")}
          >
            <span className="inline-flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              {downloading === `${period}-xlsx` ? "Generating..." : "Excel (.xlsx)"}
            </span>
          </Button>
          <Button
            variant="secondary"
            disabled={downloading !== null}
            onClick={() => downloadReport(period, "pdf")}
          >
            <span className="inline-flex items-center gap-2">
              <Download className="h-4 w-4" />
              {downloading === `${period}-pdf` ? "Generating..." : "PDF"}
            </span>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Download weekly (7 days) or monthly (30 days) progress reports in Excel or PDF."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard
          period="weekly"
          title="Weekly report"
          description="Last 7 days: daily GFF counts, priority breakdown, and coverage changes."
        />
        <ReportCard
          period="monthly"
          title="Monthly report"
          description="Last 30 days: cumulative progress, KPIs, and audit trail summary."
        />
      </div>
    </div>
  );
}
