import { SaxesParser } from "saxes";
import type {
  ParsedBaseVariant,
  ParsedDtcEntry,
  ParsedEcuVariant,
  ParsedOdxSnapshot,
  ParsedVehicleLink,
} from "./types";
import { daCodeToEcuId, parseOdxStem, sftToDaCode } from "./ecu-matcher";
import { vehicleProjectFromViId } from "./project-mapper";

interface ParseContext {
  filename: string;
  viId: string | null;
  currentViProject: ReturnType<typeof vehicleProjectFromViId>;
  inEcuVariant: boolean;
  inBaseVariant: boolean;
  inDtcDop: boolean;
  inLogicalLink: boolean;
  inVehicleInfoSpec: boolean;
  currentEcuVariant: Partial<ParsedEcuVariant> | null;
  currentBaseVariant: Partial<ParsedBaseVariant> | null;
  currentDtc: Partial<ParsedDtcEntry> | null;
  currentLogicalLink: { linkName: string; bvRef: string | null } | null;
  latestRevision: string | null;
  textStack: string[];
  captureText: boolean;
  activeTag: string | null;
  ecuVariants: ParsedEcuVariant[];
  baseVariants: ParsedBaseVariant[];
  vehicleLinks: ParsedVehicleLink[];
  dtcs: ParsedDtcEntry[];
}

function finalizeEcuVariant(ctx: ParseContext) {
  if (!ctx.currentEcuVariant?.variantId && !ctx.currentEcuVariant?.shortName) {
    ctx.currentEcuVariant = null;
    return;
  }

  const { stem, revision } = parseOdxStem(ctx.filename);
  const variantId =
    ctx.currentEcuVariant.variantId ??
    ctx.currentEcuVariant.shortName ??
    stem;

  ctx.ecuVariants.push({
    variantId,
    shortName: ctx.currentEcuVariant.shortName ?? variantId,
    odxStem: stem,
    revision: ctx.currentEcuVariant.revision ?? revision ?? ctx.latestRevision ?? "",
    parentBvRef: ctx.currentEcuVariant.parentBvRef ?? null,
    longName: ctx.currentEcuVariant.longName ?? null,
  });
  ctx.currentEcuVariant = null;
}

function finalizeBaseVariant(ctx: ParseContext) {
  if (!ctx.currentBaseVariant?.bvId && !ctx.currentBaseVariant?.shortName) {
    ctx.currentBaseVariant = null;
    return;
  }

  const bvId = ctx.currentBaseVariant.bvId ?? ctx.currentBaseVariant.shortName!;
  const sft = ctx.currentBaseVariant.sftCode ?? null;
  ctx.baseVariants.push({
    bvId,
    shortName: ctx.currentBaseVariant.shortName ?? bvId,
    sftCode: sft,
    daCode: sft ? sftToDaCode(sft) : null,
    revision: ctx.currentBaseVariant.revision ?? ctx.latestRevision,
    longName: ctx.currentBaseVariant.longName ?? null,
  });
  ctx.currentBaseVariant = null;
}

function finalizeDtc(ctx: ParseContext, bvDaEcuId: string | null) {
  if (!ctx.currentDtc) return;

  const troubleCode = ctx.currentDtc.troubleCode?.trim() || null;
  const symptom = ctx.currentDtc.symptom?.trim() || null;
  const dtcText = ctx.currentDtc.dtcText?.trim() || null;

  if (!troubleCode && !symptom && !dtcText) {
    ctx.currentDtc = null;
    return;
  }

  const ecuId =
    ctx.currentDtc.ecuId ??
    (ctx.inBaseVariant && bvDaEcuId ? bvDaEcuId : null) ??
    (ctx.inEcuVariant && ctx.currentEcuVariant?.parentBvRef
      ? null
      : null);

  if (!ecuId) {
    ctx.currentDtc = null;
    return;
  }

  ctx.dtcs.push({
    ecuId,
    troubleCode,
    symptom,
    dtcText,
    sourceFile: ctx.filename,
  });
  ctx.currentDtc = null;
}

function finalizeLogicalLink(ctx: ParseContext) {
  if (!ctx.currentLogicalLink?.bvRef || !ctx.currentViProject || !ctx.viId) {
    ctx.currentLogicalLink = null;
    return;
  }

  ctx.vehicleLinks.push({
    viId: ctx.viId,
    project: ctx.currentViProject,
    bvRef: ctx.currentLogicalLink.bvRef,
    linkName: ctx.currentLogicalLink.linkName,
  });
  ctx.currentLogicalLink = null;
}

function getAttr(
  attrs: Record<string, unknown>,
  name: string,
): string | undefined {
  const raw = attrs[name] ?? attrs[`xmlns:${name}`];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "object" && raw !== null && "value" in raw) {
    return String((raw as { value: string }).value);
  }
  return String(raw);
}

export function parseOdxBuffer(filename: string, buffer: Buffer): ParsedOdxSnapshot {
  const ctx: ParseContext = {
    filename,
    viId: null,
    currentViProject: null,
    inEcuVariant: false,
    inBaseVariant: false,
    inDtcDop: false,
    inLogicalLink: false,
    inVehicleInfoSpec: false,
    currentEcuVariant: null,
    currentBaseVariant: null,
    currentDtc: null,
    currentLogicalLink: null,
    latestRevision: null,
    textStack: [],
    captureText: false,
    activeTag: null,
    ecuVariants: [],
    baseVariants: [],
    vehicleLinks: [],
    dtcs: [],
  };

  let bvDaEcuId: string | null = null;

  const parser = new SaxesParser({ xmlns: true });

  parser.on("opentag", (node) => {
    const tag = typeof node.name === "string" ? node.name : String(node.name);
    const attrs = node.attributes as Record<string, unknown>;

    if (tag === "VEHICLE-INFO-SPEC") {
      ctx.inVehicleInfoSpec = true;
      ctx.viId = getAttr(attrs, "ID") ?? null;
      ctx.currentViProject = ctx.viId ? vehicleProjectFromViId(ctx.viId) : null;
    }

    if (tag === "ECU-VARIANT") {
      ctx.inEcuVariant = true;
      ctx.currentEcuVariant = {
        variantId: getAttr(attrs, "ID") ?? undefined,
        shortName: undefined,
        parentBvRef: undefined,
        longName: undefined,
        revision: undefined,
        odxStem: parseOdxStem(filename).stem,
      };
    }

    if (tag === "BASE-VARIANT") {
      ctx.inBaseVariant = true;
      const bvId = getAttr(attrs, "ID") ?? undefined;
      ctx.currentBaseVariant = {
        bvId,
        shortName: bvId,
        sftCode: null,
        daCode: null,
        revision: null,
        longName: null,
      };
    }

    if (tag === "LOGICAL-LINK" && ctx.inVehicleInfoSpec) {
      ctx.inLogicalLink = true;
      ctx.currentLogicalLink = { linkName: "", bvRef: null };
    }

    if (tag === "DTC-DOP") {
      ctx.inDtcDop = true;
      ctx.currentDtc = {
        ecuId: bvDaEcuId ?? undefined,
        sourceFile: filename,
      };
    }

    if (tag === "PARENT-REF" && ctx.inEcuVariant && ctx.currentEcuVariant) {
      const ref = getAttr(attrs, "ID-REF");
      if (ref) ctx.currentEcuVariant.parentBvRef = ref;
    }

    if (tag === "BASE-VARIANT-REF" && ctx.inLogicalLink && ctx.currentLogicalLink) {
      ctx.currentLogicalLink.bvRef = getAttr(attrs, "ID-REF") ?? null;
    }

    if (tag === "DOC-REVISION") {
      ctx.latestRevision = null;
    }

    const textTags = new Set([
      "SHORT-NAME",
      "LONG-NAME",
      "REVISION-LABEL",
      "TROUBLE-CODE",
      "DISPLAY-TROUBLE-CODE",
      "TEXT",
      "EXPECTED-VALUE",
    ]);

    if (textTags.has(tag)) {
      ctx.captureText = true;
      ctx.activeTag = tag;
      ctx.textStack.push("");
    }

    if (tag === "LONG-NAME") {
      const ti = getAttr(attrs, "TI");
      if (ti?.toUpperCase().startsWith("SFT") && ctx.inBaseVariant && ctx.currentBaseVariant) {
        ctx.currentBaseVariant.sftCode = ti;
        const da = sftToDaCode(ti);
        if (da) bvDaEcuId = daCodeToEcuId(da);
      }
    }
  });

  parser.on("text", (text) => {
    if (!ctx.captureText || ctx.textStack.length === 0) return;
    ctx.textStack[ctx.textStack.length - 1] += text;
  });

  parser.on("cdata", (cdata) => {
    if (!ctx.captureText || ctx.textStack.length === 0) return;
    ctx.textStack[ctx.textStack.length - 1] += cdata;
  });

  parser.on("closetag", (tagNode) => {
    const tag =
      typeof tagNode === "string" ? tagNode : String(tagNode.name);
    if (ctx.captureText && ctx.activeTag === tag) {
      const value = ctx.textStack.pop()?.trim() ?? "";

      if (tag === "SHORT-NAME") {
        if (ctx.inLogicalLink && ctx.currentLogicalLink && !ctx.currentLogicalLink.linkName) {
          ctx.currentLogicalLink.linkName = value;
        } else if (ctx.inEcuVariant && ctx.currentEcuVariant && !ctx.currentEcuVariant.shortName) {
          ctx.currentEcuVariant.shortName = value;
        } else if (ctx.inBaseVariant && ctx.currentBaseVariant && !ctx.currentBaseVariant.shortName) {
          ctx.currentBaseVariant.shortName = value;
        }
      }

      if (tag === "LONG-NAME") {
        if (ctx.inEcuVariant && ctx.currentEcuVariant) {
          ctx.currentEcuVariant.longName = value;
        } else if (ctx.inBaseVariant && ctx.currentBaseVariant) {
          ctx.currentBaseVariant.longName = value;
        }
      }

      if (tag === "REVISION-LABEL") {
        ctx.latestRevision = value;
        if (ctx.inEcuVariant && ctx.currentEcuVariant) {
          ctx.currentEcuVariant.revision = value;
        }
        if (ctx.inBaseVariant && ctx.currentBaseVariant) {
          ctx.currentBaseVariant.revision = value;
        }
      }

      if (tag === "TROUBLE-CODE" && ctx.inDtcDop && ctx.currentDtc) {
        ctx.currentDtc.troubleCode = value;
      }
      if (tag === "DISPLAY-TROUBLE-CODE" && ctx.inDtcDop && ctx.currentDtc) {
        ctx.currentDtc.symptom = value;
      }
      if (tag === "TEXT" && ctx.inDtcDop && ctx.currentDtc) {
        ctx.currentDtc.dtcText = value;
      }

      ctx.captureText = false;
      ctx.activeTag = null;
    }

    if (tag === "ECU-VARIANT") {
      finalizeEcuVariant(ctx);
      ctx.inEcuVariant = false;
    }

    if (tag === "BASE-VARIANT") {
      finalizeBaseVariant(ctx);
      ctx.inBaseVariant = false;
      bvDaEcuId = null;
    }

    if (tag === "DTC-DOP") {
      finalizeDtc(ctx, bvDaEcuId);
      ctx.inDtcDop = false;
    }

    if (tag === "LOGICAL-LINK") {
      finalizeLogicalLink(ctx);
      ctx.inLogicalLink = false;
    }

    if (tag === "VEHICLE-INFO-SPEC") {
      ctx.inVehicleInfoSpec = false;
    }
  });

  parser.write(buffer.toString("utf8"));
  parser.close();

  if (ctx.currentEcuVariant) finalizeEcuVariant(ctx);
  if (ctx.currentBaseVariant) finalizeBaseVariant(ctx);
  if (ctx.currentDtc) finalizeDtc(ctx, bvDaEcuId);

  return {
    ecuVariants: ctx.ecuVariants,
    baseVariants: ctx.baseVariants,
    vehicleLinks: ctx.vehicleLinks,
    dtcs: ctx.dtcs,
    sourceFiles: [filename],
    unmatchedFiles: [],
  };
}

export function mergeSnapshots(snapshots: ParsedOdxSnapshot[]): ParsedOdxSnapshot {
  const merged: ParsedOdxSnapshot = {
    ecuVariants: [],
    baseVariants: [],
    vehicleLinks: [],
    dtcs: [],
    sourceFiles: [],
    unmatchedFiles: [],
  };

  const bvSeen = new Set<string>();
  const evSeen = new Set<string>();
  const dtcSeen = new Set<string>();

  for (const snap of snapshots) {
    merged.sourceFiles.push(...snap.sourceFiles);
    merged.unmatchedFiles.push(...snap.unmatchedFiles);

    for (const ev of snap.ecuVariants) {
      const key = ev.odxStem;
      if (evSeen.has(key)) continue;
      evSeen.add(key);
      merged.ecuVariants.push(ev);
    }

    for (const bv of snap.baseVariants) {
      if (bvSeen.has(bv.bvId)) continue;
      bvSeen.add(bv.bvId);
      merged.baseVariants.push(bv);
    }

    merged.vehicleLinks.push(...snap.vehicleLinks);

    for (const dtc of snap.dtcs) {
      const key = `${dtc.ecuId}::${dtc.troubleCode ?? ""}::${dtc.symptom ?? ""}`;
      if (dtcSeen.has(key)) continue;
      dtcSeen.add(key);
      merged.dtcs.push(dtc);
    }
  }

  return merged;
}
