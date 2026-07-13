import { getDb } from "@/lib/db";
import type { VehicleProjectId } from "@/lib/types";
import { daCodeToEcuId } from "./ecu-matcher";
import {
  applicableColumnForProject,
  odxColumnForProject,
} from "./project-mapper";
import type {
  DtcDiffEntry,
  EcuSoftwareChange,
  EvUpdateDiff,
  ParsedOdxSnapshot,
} from "./types";

interface DbEcuRow {
  id: string;
  code: string;
  odx_lb74x: string | null;
  odx_lb636: string | null;
  odx_lb63x: string | null;
  lb74x_applicable: number;
  lb636_applicable: number;
  lb63x_applicable: number;
}

interface DbDtcRow {
  id: number;
  ecu_id: string;
  trouble_code: string | null;
  symptom: string | null;
  dtc_text: string | null;
  applicable_lb74x: number;
  applicable_lb636: number;
  applicable_lb63x: number;
}

function dtcKey(ecuId: string, troubleCode: string | null, symptom: string | null): string {
  return `${ecuId}::${(troubleCode ?? "").toUpperCase()}::${(symptom ?? "").toUpperCase()}`;
}

function buildBvMaps(snapshot: ParsedOdxSnapshot) {
  const bvToEcuId = new Map<string, string>();
  const bvToProjects = new Map<string, Set<VehicleProjectId>>();

  for (const bv of snapshot.baseVariants) {
    if (bv.daCode) {
      bvToEcuId.set(bv.bvId, daCodeToEcuId(bv.daCode));
    }
  }

  for (const link of snapshot.vehicleLinks) {
    const set = bvToProjects.get(link.bvRef) ?? new Set<VehicleProjectId>();
    set.add(link.project);
    bvToProjects.set(link.bvRef, set);
  }

  return { bvToEcuId, bvToProjects };
}

function resolveProjectsForVariant(
  parentBvRef: string | null,
  bvToProjects: Map<string, Set<VehicleProjectId>>,
  ecu: DbEcuRow | undefined,
): VehicleProjectId[] {
  const fromVi = parentBvRef ? bvToProjects.get(parentBvRef) : undefined;
  if (fromVi && fromVi.size > 0) {
    return [...fromVi];
  }

  if (!ecu) return ["LB74x", "LB636", "LB63x"];

  const projects: VehicleProjectId[] = [];
  if (ecu.lb74x_applicable) projects.push("LB74x");
  if (ecu.lb636_applicable) projects.push("LB636");
  if (ecu.lb63x_applicable) projects.push("LB63x");
  return projects.length > 0 ? projects : ["LB74x", "LB636", "LB63x"];
}

function findEcuByOdxPrefix(ecus: DbEcuRow[], odxStem: string): DbEcuRow | undefined {
  const prefix = odxStem.replace(/_\d{6}(?:_d)?$/i, "");
  return ecus.find(
    (ecu) =>
      ecu.odx_lb74x?.startsWith(prefix) ||
      ecu.odx_lb636?.startsWith(prefix) ||
      ecu.odx_lb63x?.startsWith(prefix),
  );
}

export function computeEvUpdateDiff(snapshot: ParsedOdxSnapshot): EvUpdateDiff {
  const db = getDb();
  const ecus = db.prepare("SELECT * FROM ecus").all() as DbEcuRow[];
  const dtcs = db
    .prepare(
      `SELECT id, ecu_id, trouble_code, symptom, dtc_text,
              applicable_lb74x, applicable_lb636, applicable_lb63x
       FROM dtcs`,
    )
    .all() as DbDtcRow[];

  const ecuById = new Map(ecus.map((ecu) => [ecu.id, ecu]));
  const { bvToEcuId, bvToProjects } = buildBvMaps(snapshot);

  const ecuSoftwareChanges: EcuSoftwareChange[] = [];
  const unmatchedVariants: string[] = [];
  const affectedEcuIds = new Set<string>();

  for (const variant of snapshot.ecuVariants) {
    let ecuId =
      (variant.parentBvRef ? bvToEcuId.get(variant.parentBvRef) : undefined) ??
      null;

    let ecu = ecuId ? ecuById.get(ecuId) : undefined;
    if (!ecu) {
      ecu = findEcuByOdxPrefix(ecus, variant.odxStem);
      ecuId = ecu?.id ?? null;
    }

    if (!ecu || !ecuId) {
      unmatchedVariants.push(variant.variantId);
      continue;
    }

    const projects = resolveProjectsForVariant(
      variant.parentBvRef,
      bvToProjects,
      ecu,
    );

    for (const project of projects) {
      const column = odxColumnForProject(project);
      const current = ecu[column];
      if (current === variant.odxStem) continue;

      ecuSoftwareChanges.push({
        ecuId,
        ecuCode: ecu.code,
        project,
        from: current,
        to: variant.odxStem,
        variantId: variant.variantId,
      });
      affectedEcuIds.add(ecuId);
    }
  }

  const parsedDtcByKey = new Map<string, (typeof snapshot.dtcs)[number]>();
  for (const dtc of snapshot.dtcs) {
    parsedDtcByKey.set(dtcKey(dtc.ecuId, dtc.troubleCode, dtc.symptom), dtc);
  }

  const dbDtcByKey = new Map<string, DbDtcRow>();
  for (const dtc of dtcs) {
    dbDtcByKey.set(dtcKey(dtc.ecu_id, dtc.trouble_code, dtc.symptom), dtc);
  }

  const dtcChanges: DtcDiffEntry[] = [];

  for (const [key, parsed] of parsedDtcByKey) {
    const existing = dbDtcByKey.get(key);
    const ecu = ecuById.get(parsed.ecuId);

    if (!existing) {
      dtcChanges.push({
        type: "added",
        ecuId: parsed.ecuId,
        ecuCode: ecu?.code ?? parsed.ecuId.replace(/^DA/, ""),
        troubleCode: parsed.troubleCode,
        symptom: parsed.symptom,
        dtcText: parsed.dtcText,
      });
      affectedEcuIds.add(parsed.ecuId);
      continue;
    }

    const fields: string[] = [];
    if ((parsed.dtcText ?? "") !== (existing.dtc_text ?? "")) fields.push("dtc_text");
    if ((parsed.symptom ?? "") !== (existing.symptom ?? "")) fields.push("symptom");
    if ((parsed.troubleCode ?? "") !== (existing.trouble_code ?? "")) {
      fields.push("trouble_code");
    }

    if (fields.length > 0) {
      dtcChanges.push({
        type: "modified",
        ecuId: parsed.ecuId,
        ecuCode: ecu?.code ?? parsed.ecuId.replace(/^DA/, ""),
        dtcId: existing.id,
        troubleCode: parsed.troubleCode,
        symptom: parsed.symptom,
        dtcText: parsed.dtcText,
        previousDtcText: existing.dtc_text,
        fields,
      });
      affectedEcuIds.add(parsed.ecuId);
    }
  }

  for (const ecuId of affectedEcuIds) {
    if (snapshot.dtcs.length === 0) continue;

    const ecuParsed = snapshot.dtcs.filter((d) => d.ecuId === ecuId);
    if (ecuParsed.length === 0) continue;

    const parsedKeysForEcu = new Set(
      ecuParsed.map((d) => dtcKey(d.ecuId, d.troubleCode, d.symptom)),
    );

    for (const dtc of dtcs.filter((d) => d.ecu_id === ecuId)) {
      const key = dtcKey(dtc.ecu_id, dtc.trouble_code, dtc.symptom);
      if (parsedKeysForEcu.has(key)) continue;
      if (
        !dtc.applicable_lb74x &&
        !dtc.applicable_lb636 &&
        !dtc.applicable_lb63x
      ) {
        continue;
      }

      const ecu = ecuById.get(ecuId);
      dtcChanges.push({
        type: "removed",
        ecuId,
        ecuCode: ecu?.code ?? ecuId.replace(/^DA/, ""),
        dtcId: dtc.id,
        troubleCode: dtc.trouble_code,
        symptom: dtc.symptom,
        dtcText: dtc.dtc_text,
      });
    }
  }

  const ecuIdsUpdated = new Set(ecuSoftwareChanges.map((c) => c.ecuId)).size;

  return {
    ecuSoftwareChanges,
    dtcChanges,
    unmatchedVariants,
    summary: {
      ecusUpdated: ecuIdsUpdated,
      dtcsAdded: dtcChanges.filter((c) => c.type === "added").length,
      dtcsRemoved: dtcChanges.filter((c) => c.type === "removed").length,
      dtcsModified: dtcChanges.filter((c) => c.type === "modified").length,
      filesProcessed: snapshot.sourceFiles.length,
    },
  };
}

export function loadDbEcuApplicability(ecuId: string): Record<VehicleProjectId, boolean> {
  const db = getDb();
  const ecu = db.prepare("SELECT * FROM ecus WHERE id = ?").get(ecuId) as DbEcuRow | undefined;
  return {
    LB74x: !!ecu?.lb74x_applicable,
    LB636: !!ecu?.lb636_applicable,
    LB63x: !!ecu?.lb63x_applicable,
  };
}

export function getApplicableColumns() {
  return {
    LB74x: applicableColumnForProject("LB74x"),
    LB636: applicableColumnForProject("LB636"),
    LB63x: applicableColumnForProject("LB63x"),
  } as const;
}
