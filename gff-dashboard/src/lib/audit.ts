import { getDb } from "./db";
import {
  datetimeEndOfDay,
  datetimeStartOfDay,
  nowSqliteDatetime,
} from "./datetime";

export type AuditEventType =
  | "bulk_update"
  | "import"
  | "export"
  | "report"
  | "ev_update";

export interface AuditUser {
  userId: number | null;
  username: string | null;
}

export function logAuditEvent(input: {
  eventType: AuditEventType;
  summary: string;
  user?: AuditUser;
  details?: Record<string, unknown>;
}): number {
  const db = getDb();
  const result = db
    .prepare(
      `
      INSERT INTO audit_events (event_type, user_id, username, summary, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      input.eventType,
      input.user?.userId ?? null,
      input.user?.username ?? null,
      input.summary,
      input.details ? JSON.stringify(input.details) : null,
      nowSqliteDatetime(),
    );
  return Number(result.lastInsertRowid);
}

export interface AuditEventRow {
  id: number;
  event_type: AuditEventType;
  user_id: number | null;
  username: string | null;
  summary: string;
  details_json: string | null;
  created_at: string;
}

export interface CoverageChangeRow {
  id: number;
  dtc_id: number;
  ecu_id: string;
  project: string;
  from_status: string;
  to_status: string;
  stat_date: string;
  changed_at: string;
  user_id: number | null;
  username: string | null;
  trouble_code: string | null;
  symptom: string | null;
  change_source: string;
  ecu_code?: string;
}

export interface CoverageChangeActivity {
  kind: "coverage_change";
  id: number;
  timestamp: string;
  username: string | null;
  summary: string;
  details: CoverageChangeRow;
}

export interface AuditEventActivity {
  kind: "audit_event";
  id: number;
  timestamp: string;
  username: string | null;
  summary: string;
  eventType: AuditEventType;
  details: Record<string, unknown> | null;
}

export interface BulkUpdateActivity {
  kind: "bulk_update";
  id: number;
  timestamp: string;
  username: string | null;
  summary: string;
  eventType: "bulk_update";
  details: Record<string, unknown> | null;
  children: CoverageChangeActivity[];
}

export type ActivityDisplayEntry =
  | CoverageChangeActivity
  | AuditEventActivity
  | BulkUpdateActivity;

function coverageSummary(row: CoverageChangeRow): string {
  return `${row.ecu_code}: ${row.trouble_code ?? row.symptom ?? `DTC #${row.dtc_id}`} ${row.project} ${row.from_status} → ${row.to_status}`;
}

function matchesTimestampRange(
  timestamp: string,
  from?: string,
  to?: string,
): boolean {
  if (from && timestamp < datetimeStartOfDay(from)) return false;
  if (to && timestamp > datetimeEndOfDay(to)) return false;
  return true;
}

function collectBulkChangeIds(
  details: Record<string, unknown> | null,
): number[] {
  if (!details || !Array.isArray(details.changeIds)) return [];
  return details.changeIds.filter(
    (id): id is number => typeof id === "number",
  );
}

function fallbackBulkChangeIds(
  bulkEvent: AuditEventRow,
  coverageRows: CoverageChangeRow[],
): number[] {
  const bulkTime = bulkEvent.created_at.slice(0, 19);
  return coverageRows
    .filter(
      (row) =>
        row.change_source === "bulk" &&
        row.username === bulkEvent.username &&
        row.changed_at.slice(0, 19) === bulkTime,
    )
    .map((row) => row.id);
}

export function getActivityLog(filters?: {
  page?: number;
  pageSize?: number;
  eventType?: string;
  role?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const db = getDb();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  let usernamesForRole: string[] | null = null;
  if (filters?.role) {
    usernamesForRole = (
      db
        .prepare("SELECT username FROM users WHERE role = ?")
        .all(filters.role) as Array<{ username: string }>
    ).map((row) => row.username);
  }

  function matchesRole(username: string | null): boolean {
    if (!filters?.role) return true;
    if (!username) return false;
    return usernamesForRole?.includes(username) ?? false;
  }

  const coverageRows = db
    .prepare(
      `
      SELECT cc.*, e.code as ecu_code, u.role as user_role
      FROM coverage_changes cc
      JOIN ecus e ON e.id = cc.ecu_id
      LEFT JOIN users u ON u.username = cc.username
      ORDER BY cc.changed_at DESC
      LIMIT 2000
    `,
    )
    .all() as Array<CoverageChangeRow & { user_role?: string | null }>;

  let auditQuery = "SELECT * FROM audit_events WHERE 1=1";
  const auditParams: Array<string | number> = [];

  if (filters?.eventType && filters.eventType !== "coverage_change") {
    auditQuery += " AND event_type = ?";
    auditParams.push(filters.eventType);
  }

  auditQuery += " ORDER BY created_at DESC LIMIT 2000";

  const auditRows = db
    .prepare(auditQuery)
    .all(...auditParams) as AuditEventRow[];

  const coverageById = new Map<number, CoverageChangeActivity>();
  for (const row of coverageRows) {
    if (!matchesRole(row.username)) continue;
    if (
      !matchesTimestampRange(row.changed_at, filters?.fromDate, filters?.toDate)
    ) {
      continue;
    }
    coverageById.set(row.id, {
      kind: "coverage_change",
      id: row.id,
      timestamp: row.changed_at,
      username: row.username,
      summary: coverageSummary(row),
      details: row,
    });
  }

  const groupedChangeIds = new Set<number>();
  const displayEntries: ActivityDisplayEntry[] = [];

  const bulkEvents = auditRows.filter((row) => row.event_type === "bulk_update");
  const otherAuditEvents = auditRows.filter(
    (row) => row.event_type !== "bulk_update",
  );

  for (const row of bulkEvents) {
    if (!matchesRole(row.username)) continue;
    if (
      !matchesTimestampRange(row.created_at, filters?.fromDate, filters?.toDate)
    ) {
      continue;
    }
    if (filters?.eventType && filters.eventType !== "bulk_update") continue;

    const details = row.details_json
      ? (JSON.parse(row.details_json) as Record<string, unknown>)
      : null;

    let changeIds = collectBulkChangeIds(details);
    if (changeIds.length === 0) {
      changeIds = fallbackBulkChangeIds(row, coverageRows);
    }

    const children = changeIds
      .map((id) => coverageById.get(id))
      .filter((entry): entry is CoverageChangeActivity => Boolean(entry));

    for (const child of children) {
      groupedChangeIds.add(child.id);
    }

    displayEntries.push({
      kind: "bulk_update",
      id: row.id,
      timestamp: row.created_at,
      username: row.username,
      summary: row.summary,
      eventType: "bulk_update",
      details,
      children,
    });
  }

  if (!filters?.eventType || filters.eventType === "coverage_change") {
    for (const entry of coverageById.values()) {
      if (groupedChangeIds.has(entry.id)) continue;
      if (entry.details.change_source === "bulk") continue;
      displayEntries.push(entry);
    }
  }

  for (const row of otherAuditEvents) {
    if (!matchesRole(row.username)) continue;
    if (
      !matchesTimestampRange(row.created_at, filters?.fromDate, filters?.toDate)
    ) {
      continue;
    }
    if (filters?.eventType && filters.eventType !== row.event_type) continue;

    displayEntries.push({
      kind: "audit_event",
      id: row.id,
      timestamp: row.created_at,
      username: row.username,
      summary: row.summary,
      eventType: row.event_type,
      details: row.details_json
        ? (JSON.parse(row.details_json) as Record<string, unknown>)
        : null,
    });
  }

  displayEntries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const total = displayEntries.length;
  const items = displayEntries.slice(offset, offset + pageSize);

  return { items, total, page, pageSize };
}
