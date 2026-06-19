"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  FilterInput,
  PageHeader,
  SelectInput,
} from "@/components/ui";
import type { FaultyDtc } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export default function FaultyPage() {
  const [items, setItems] = useState<FaultyDtc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [daCode, setDaCode] = useState("");
  const [issue, setIssue] = useState("");
  const [daOptions, setDaOptions] = useState<string[]>([]);
  const [issueOptions, setIssueOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/faulty?options=1")
      .then((res) => res.json())
      .then((data) => {
        setDaOptions(data.daCodes ?? []);
        setIssueOptions(data.issues ?? []);
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (search) params.set("search", search);
    if (daCode) params.set("da_code", daCode);
    if (issue) params.set("issue", issue);

    setLoading(true);
    fetch(`/api/faulty?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, search, daCode, issue]);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div>
      <PageHeader
        title="Faulty DTCs"
        description="Read-only list of DTC records flagged with data quality issues."
      />

      <Card className="mb-6 grid gap-3 lg:grid-cols-3">
        <FilterInput
          value={search}
          onChange={(value) => {
            setPage(1);
            setSearch(value);
          }}
          placeholder="Search symptom, code, text, EV..."
        />
        <SelectInput
          value={daCode}
          onChange={(value) => {
            setPage(1);
            setDaCode(value);
          }}
          options={[
            { value: "", label: "All ECUs" },
            ...daOptions.map((code) => ({ value: code, label: code })),
          ]}
        />
        <SelectInput
          value={issue}
          onChange={(value) => {
            setPage(1);
            setIssue(value);
          }}
          options={[
            { value: "", label: "All issues" },
            ...issueOptions.map((item) => ({ value: item, label: item })),
          ]}
        />
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-card-border flex items-center justify-between border-b px-4 py-3">
          <p className="text-muted text-sm">
            {formatNumber(total)} faulty records
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-muted text-sm">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-card-border bg-white/5 border-b">
              <tr className="text-muted text-left">
                <th className="px-4 py-3">Symptom</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Text</th>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">EV</th>
                <th className="px-4 py-3">ECU</th>
                <th className="px-4 py-3">Projects</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-muted px-4 py-8 text-center">
                    Loading faulty DTCs...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-muted px-4 py-8 text-center">
                    No records match the current filters.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-card-border hover:bg-white/5 border-b align-top last:border-b-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{row.symptom}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.trouble_code}</td>
                    <td className="max-w-xs px-4 py-3">{row.dtc_text}</td>
                    <td className="max-w-xs px-4 py-3">{row.issue_description}</td>
                    <td className="max-w-xs px-4 py-3 font-mono text-xs">{row.ev_name}</td>
                    <td className="px-4 py-3">{row.da_code}</td>
                    <td className="px-4 py-3">{row.projects_impacted}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
