import { getDb } from "@/lib/db";
import type { AuditUser } from "@/lib/audit";
import { logAuditEvent } from "@/lib/audit";
import { recordCoverageTransition } from "@/lib/daily-coverage-sync";
import type { VehicleProjectId } from "@/lib/types";
import { computeEvUpdateDiff } from "./diff";
import { extractOdxEntries } from "./archive";
import { mergeSnapshots, parseOdxBuffer } from "./parse-odx";
import { applicableColumnForProject, odxColumnForProject } from "./project-mapper";
import type { EvUpdateDiff, EvUpdateResult, ParsedOdxSnapshot } from "./types";

export async function parseOdxUpload(
  buffer: Buffer,
  filename: string,
): Promise<ParsedOdxSnapshot> {
  const entries = await extractOdxEntries(buffer, filename);
  const snapshots = entries.map((entry) =>
    parseOdxBuffer(entry.name, entry.buffer),
  );
  return mergeSnapshots(snapshots);
}

export function applyEvUpdateDiff(
  diff: EvUpdateDiff,
  auditUser?: AuditUser,
): void {
  const db = getDb();

  const updateOdx = db.prepare(
    `UPDATE ecus SET odx_lb74x = ?, odx_lb636 = ?, odx_lb63x = ? WHERE id = ?`,
  );

  const insertDtc = db.prepare(`
    INSERT INTO dtcs (
      ecu_id, symptom, trouble_code, dtc_text, error_handling,
      error_setting_conditions, gff_available, gff_program,
      category, label, coverage_lb74x, coverage_lb636, coverage_lb63x,
      applicable_lb74x, applicable_lb636, applicable_lb63x
    ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)
  `);

  const updateDtcText = db.prepare(`
    UPDATE dtcs SET trouble_code = ?, symptom = ?, dtc_text = ? WHERE id = ?
  `);

  const deactivateDtc = db.prepare(`
    UPDATE dtcs SET applicable_lb74x = 0, applicable_lb636 = 0, applicable_lb63x = 0 WHERE id = ?
  `);

  const getEcu = db.prepare("SELECT * FROM ecus WHERE id = ?");
  const getDtc = db.prepare("SELECT * FROM dtcs WHERE id = ?");

  const applyTx = db.transaction(() => {
    const odxByEcu = new Map<
      string,
      { odx_lb74x: string | null; odx_lb636: string | null; odx_lb63x: string | null }
    >();

    for (const change of diff.ecuSoftwareChanges) {
      const current =
        odxByEcu.get(change.ecuId) ??
        (getEcu.get(change.ecuId) as {
          odx_lb74x: string | null;
          odx_lb636: string | null;
          odx_lb63x: string | null;
        } | undefined);

      if (!current) continue;

      const next = {
        odx_lb74x: current.odx_lb74x,
        odx_lb636: current.odx_lb636,
        odx_lb63x: current.odx_lb63x,
      };
      const col = odxColumnForProject(change.project);
      next[col] = change.to;
      odxByEcu.set(change.ecuId, next);
    }

    for (const [ecuId, odx] of odxByEcu) {
      updateOdx.run(odx.odx_lb74x, odx.odx_lb636, odx.odx_lb63x, ecuId);
    }

    for (const dtc of diff.dtcChanges) {
      if (dtc.type === "added") {
        const ecu = getEcu.get(dtc.ecuId) as {
          lb74x_applicable: number;
          lb636_applicable: number;
          lb63x_applicable: number;
        } | undefined;

        insertDtc.run(
          dtc.ecuId,
          dtc.symptom,
          dtc.troubleCode,
          dtc.dtcText,
          ecu?.lb74x_applicable ? 1 : 0,
          ecu?.lb636_applicable ? 1 : 0,
          ecu?.lb63x_applicable ? 1 : 0,
        );
        continue;
      }

      if (dtc.type === "modified" && dtc.dtcId) {
        updateDtcText.run(
          dtc.troubleCode,
          dtc.symptom,
          dtc.dtcText,
          dtc.dtcId,
        );
        continue;
      }

      if (dtc.type === "removed" && dtc.dtcId) {
        const existing = getDtc.get(dtc.dtcId) as {
          id: number;
          ecu_id: string;
          trouble_code: string | null;
          symptom: string | null;
          coverage_lb74x: string | null;
          coverage_lb636: string | null;
          coverage_lb63x: string | null;
          applicable_lb74x: number;
          applicable_lb636: number;
          applicable_lb63x: number;
        };

        if (!existing) continue;

        const projects: VehicleProjectId[] = ["LB74x", "LB636", "LB63x"];
        for (const project of projects) {
          const appCol = applicableColumnForProject(project);
          if (!existing[appCol]) continue;

          const covCol =
            project === "LB74x"
              ? "coverage_lb74x"
              : project === "LB636"
                ? "coverage_lb636"
                : "coverage_lb63x";
          const coverage = existing[covCol];
          if (coverage === "covered" || coverage === "pending") {
            recordCoverageTransition({
              dtcId: existing.id,
              ecuId: existing.ecu_id,
              project,
              fromStatus: coverage,
              toStatus: "pending",
              userId: auditUser?.userId ?? null,
              username: auditUser?.username ?? null,
              troubleCode: existing.trouble_code,
              symptom: existing.symptom,
              changeSource: "ev_update",
              syncDaily: false,
            });
          }
        }

        deactivateDtc.run(dtc.dtcId);
      }
    }
  });

  applyTx();
}

export async function runEvUpdate(
  buffer: Buffer,
  filename: string,
  auditUser?: AuditUser,
  options?: { dryRun?: boolean },
): Promise<EvUpdateResult> {
  const snapshot = await parseOdxUpload(buffer, filename);
  const diff = computeEvUpdateDiff(snapshot);

  const hasChanges =
    diff.ecuSoftwareChanges.length > 0 || diff.dtcChanges.length > 0;

  if (!options?.dryRun && hasChanges) {
    applyEvUpdateDiff(diff, auditUser);

    logAuditEvent({
      eventType: "ev_update",
      summary: `EV Update: ${diff.summary.ecusUpdated} ECUs, +${diff.summary.dtcsAdded}/-${diff.summary.dtcsRemoved}/~${diff.summary.dtcsModified} DTCs`,
      user: auditUser,
      details: {
        source: "ev_update",
        filename,
        ...diff.summary,
        unmatchedVariants: diff.unmatchedVariants,
      },
    });
  }

  return { diff, applied: !options?.dryRun && hasChanges };
}
