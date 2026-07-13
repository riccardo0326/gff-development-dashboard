import type { VehicleProjectId } from "@/lib/types";

export type EvDiffChangeType = "added" | "removed" | "modified";

export interface ParsedEcuVariant {
  variantId: string;
  shortName: string;
  odxStem: string;
  revision: string;
  parentBvRef: string | null;
  longName: string | null;
}

export interface ParsedBaseVariant {
  bvId: string;
  shortName: string;
  sftCode: string | null;
  daCode: string | null;
  revision: string | null;
  longName: string | null;
}

export interface ParsedVehicleLink {
  viId: string;
  project: VehicleProjectId;
  bvRef: string;
  linkName: string;
}

export interface ParsedDtcEntry {
  ecuId: string;
  troubleCode: string | null;
  symptom: string | null;
  dtcText: string | null;
  sourceFile: string;
}

export interface ParsedOdxSnapshot {
  ecuVariants: ParsedEcuVariant[];
  baseVariants: ParsedBaseVariant[];
  vehicleLinks: ParsedVehicleLink[];
  dtcs: ParsedDtcEntry[];
  sourceFiles: string[];
  unmatchedFiles: string[];
}

export interface EcuSoftwareChange {
  ecuId: string;
  ecuCode: string;
  project: VehicleProjectId;
  from: string | null;
  to: string;
  variantId: string;
}

export interface DtcDiffEntry {
  type: EvDiffChangeType;
  ecuId: string;
  ecuCode: string;
  dtcId?: number;
  troubleCode: string | null;
  symptom: string | null;
  dtcText: string | null;
  previousDtcText?: string | null;
  fields?: string[];
}

export interface EvUpdateDiff {
  ecuSoftwareChanges: EcuSoftwareChange[];
  dtcChanges: DtcDiffEntry[];
  unmatchedVariants: string[];
  summary: {
    ecusUpdated: number;
    dtcsAdded: number;
    dtcsRemoved: number;
    dtcsModified: number;
    filesProcessed: number;
  };
}

export interface EvUpdateResult {
  diff: EvUpdateDiff;
  applied: boolean;
}
