"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  PageHeader,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  DtcDiffEntry,
  EvUpdateDiff,
} from "@/lib/odx/types";

type Phase = "idle" | "preview" | "applied";

const ACCEPT = ".odx,.xml,.pdx,.zip";

function changeBadge(type: DtcDiffEntry["type"]) {
  const styles = {
    added: "bg-success/15 text-green-200 ring-success/30",
    removed: "bg-danger/15 text-red-200 ring-danger/30",
    modified: "bg-warning/15 text-amber-200 ring-warning/30",
  };
  const labels = {
    added: "Added",
    removed: "Removed",
    modified: "Modified",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[type],
      )}
    >
      {labels[type]}
    </span>
  );
}

export default function EvUpdatePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  const [diff, setDiff] = useState<EvUpdateDiff | null>(null);

  const processFile = useCallback(async (file: File, dryRun: boolean) => {
    setLoading(true);
    setError("");
    setFilename(file.name);
    setSelectedFile(file);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `/api/ev-update${dryRun ? "?dryRun=true" : ""}`,
        { method: "POST", body: formData },
      );
      const payload = (await response.json()) as {
        error?: string;
        diff?: EvUpdateDiff;
        applied?: boolean;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Processing failed");
      }

      if (!payload.diff) {
        throw new Error("No diff returned from server");
      }

      setDiff(payload.diff);
      setPhase(dryRun ? "preview" : "applied");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not process the file.",
      );
      setPhase("idle");
      setDiff(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function onFilesSelected(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    void processFile(file, true);
  }

  function reset() {
    setPhase("idle");
    setDiff(null);
    setError("");
    setFilename("");
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function applyChanges() {
    if (!selectedFile) {
      setError("Re-select the file to apply changes.");
      return;
    }
    await processFile(selectedFile, false);
  }

  const hasChanges =
    !!diff &&
    (diff.ecuSoftwareChanges.length > 0 || diff.dtcChanges.length > 0);

  return (
    <div>
      <PageHeader
        title="EV Update"
        description="Upload ODX or PDX diagnostic data to compare against the current database and sync ECU software versions and DTC inventory."
        actions={
          phase !== "idle" ? (
            <Button variant="secondary" onClick={reset}>
              New upload
            </Button>
          ) : null
        }
      />

      {phase === "idle" ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            onFilesSelected(event.dataTransfer.files);
          }}
        >
          <Card
            className={cn(
              "border-dashed transition-colors",
              dragging && "border-accent bg-accent-soft/30",
            )}
          >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => onFilesSelected(event.target.files)}
          />

          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="bg-accent-soft text-accent flex h-14 w-14 items-center justify-center rounded-full">
              {loading ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <FileUp className="h-7 w-7" />
              )}
            </div>
            <div>
              <p className="text-lg font-medium">
                Drop ODX / PDX / ZIP here
              </p>
              <p className="text-muted mt-1 text-sm">
                Single .odx/.xml files or cumulative archives (.pdx, .zip)
              </p>
            </div>
            <Button
              type="button"
              disabled={loading}
              onClick={() => inputRef.current?.click()}
            >
              {loading ? "Parsing…" : "Choose file"}
            </Button>
          </div>
          </Card>
        </div>
      ) : null}

      {error ? (
        <Card className="border-danger/40 bg-danger/5 mt-4">
          <p className="text-danger text-sm">{error}</p>
        </Card>
      ) : null}

      {diff ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="Files parsed" value={diff.summary.filesProcessed} />
            <SummaryCard label="ECUs updated" value={diff.summary.ecusUpdated} />
            <SummaryCard label="DTCs added" value={diff.summary.dtcsAdded} />
            <SummaryCard label="DTCs removed" value={diff.summary.dtcsRemoved} />
            <SummaryCard label="DTCs modified" value={diff.summary.dtcsModified} />
          </div>

          {filename ? (
            <p className="text-muted text-sm">
              Source: <span className="text-foreground font-medium">{filename}</span>
              {phase === "applied" ? (
                <span className="text-success ml-2 inline-flex items-center gap-1">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Applied
                </span>
              ) : null}
            </p>
          ) : null}

          {diff.unmatchedVariants.length > 0 ? (
            <Card>
              <h3 className="font-medium">Unmatched variants</h3>
              <p className="text-muted mt-1 text-sm">
                These EV variants could not be linked to an ECU in the database.
              </p>
              <ul className="text-muted mt-3 list-inside list-disc text-sm">
                {diff.unmatchedVariants.map((variant) => (
                  <li key={variant}>{variant}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          {diff.ecuSoftwareChanges.length > 0 ? (
            <Card>
              <h3 className="mb-4 font-medium">ECU software changes</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-card-border border-b">
                    <tr className="text-muted text-left">
                      <th className="px-3 py-2">ECU</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Previous ODX</th>
                      <th className="px-3 py-2">New ODX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.ecuSoftwareChanges.map((change) => (
                      <tr
                        key={`${change.ecuId}-${change.project}-${change.to}`}
                        className="border-card-border border-b last:border-0"
                      >
                        <td className="px-3 py-2 font-medium">
                          DA{change.ecuCode}
                        </td>
                        <td className="px-3 py-2">{change.project}</td>
                        <td className="text-muted max-w-xs truncate px-3 py-2 text-xs">
                          {change.from ?? "—"}
                        </td>
                        <td className="max-w-xs truncate px-3 py-2 text-xs">
                          {change.to}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {diff.dtcChanges.length > 0 ? (
            <Card>
              <h3 className="mb-4 font-medium">DTC changes</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-card-border border-b">
                    <tr className="text-muted text-left">
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">ECU</th>
                      <th className="px-3 py-2">Trouble code</th>
                      <th className="px-3 py-2">Symptom</th>
                      <th className="px-3 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.dtcChanges.map((change, index) => (
                      <tr
                        key={`${change.type}-${change.ecuId}-${index}`}
                        className="border-card-border border-b last:border-0"
                      >
                        <td className="px-3 py-2">{changeBadge(change.type)}</td>
                        <td className="px-3 py-2">DA{change.ecuCode}</td>
                        <td className="px-3 py-2">{change.troubleCode ?? "—"}</td>
                        <td className="px-3 py-2">{change.symptom ?? "—"}</td>
                        <td className="max-w-md truncate px-3 py-2">
                          {change.dtcText ?? change.previousDtcText ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {!hasChanges ? (
            <Card>
              <p className="text-muted text-sm">
                No differences detected between the uploaded diagnostic data and
                the current database state.
              </p>
            </Card>
          ) : null}

          {phase === "preview" && hasChanges ? (
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void applyChanges()} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying…
                  </>
                ) : (
                  "Apply changes"
                )}
              </Button>
              <Button variant="secondary" onClick={reset}>
                Cancel
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="py-4">
      <p className="text-muted text-xs tracking-wide uppercase">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
