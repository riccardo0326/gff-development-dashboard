import { getDb } from "./db";
import { hasGffAvailable } from "./gff";

/** Subquery returning DTC ids matched from the faulty_dtcs import list. */
export const FAULTY_MATCHED_DTC_IDS_SQL = `
  SELECT DISTINCT d_inner.id
  FROM faulty_dtcs f
  LEFT JOIN ecus e ON e.code = REPLACE(UPPER(COALESCE(f.da_code, '')), 'DA', '')
    OR e.id = UPPER(COALESCE(f.da_code, ''))
  JOIN dtcs d_inner ON d_inner.ecu_id = e.id AND d_inner.trouble_code = f.trouble_code
`;

export interface FaultyDtcMetadata {
  issue_description: string | null;
  ev_name: string | null;
  projects_impacted: string | null;
}

export function isDtcCountedAsFaulty(
  dtcId: number,
  gffAvailable: string | null | undefined,
  faultyDtcIds: Set<number>,
): boolean {
  return faultyDtcIds.has(dtcId) && !hasGffAvailable(gffAvailable);
}

export function getFaultyDtcMetadataMap(): Map<number, FaultyDtcMetadata> {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT d.id as dtc_id,
             f.issue_description,
             f.ev_name,
             f.projects_impacted
      FROM faulty_dtcs f
      LEFT JOIN ecus e ON e.code = REPLACE(UPPER(COALESCE(f.da_code, '')), 'DA', '')
        OR e.id = UPPER(COALESCE(f.da_code, ''))
      JOIN dtcs d ON d.ecu_id = e.id AND d.trouble_code = f.trouble_code
    `,
    )
    .all() as Array<FaultyDtcMetadata & { dtc_id: number }>;

  const map = new Map<number, FaultyDtcMetadata>();
  for (const row of rows) {
    map.set(row.dtc_id, {
      issue_description: row.issue_description,
      ev_name: row.ev_name,
      projects_impacted: row.projects_impacted,
    });
  }
  return map;
}

export function appendFaultyOnlyFilter(
  query: string,
  params: Array<string | number>,
  options: { idColumn?: string; gffColumn?: string } = {},
): { query: string; params: Array<string | number> } {
  const idColumn = options.idColumn ?? "id";
  const gffColumn = options.gffColumn ?? "gff_available";

  return {
    query: `${query} AND ${idColumn} IN (${FAULTY_MATCHED_DTC_IDS_SQL}) AND (${gffColumn} IS NULL OR LOWER(TRIM(${gffColumn})) != 'y')`,
    params,
  };
}

export function enrichDtcRow<
  T extends { id: number; gff_available: string | null },
>(
  row: T,
  faultyDtcIds: Set<number>,
  metadata: Map<number, FaultyDtcMetadata>,
): T & FaultyDtcMetadata & { is_faulty: boolean } {
  const meta = metadata.get(row.id);
  return {
    ...row,
    is_faulty: isDtcCountedAsFaulty(row.id, row.gff_available, faultyDtcIds),
    issue_description: meta?.issue_description ?? null,
    ev_name: meta?.ev_name ?? null,
    projects_impacted: meta?.projects_impacted ?? null,
  };
}
