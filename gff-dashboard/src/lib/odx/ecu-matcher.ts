import { normalizeDaCode, toDaId } from "@/lib/excel/mappers";

/** Convert VW SFT code (e.g. SFT08104) to DA code (8104). */
export function sftToDaCode(sft: string): string | null {
  const raw = sft.trim().toUpperCase().replace(/^SFT/, "");
  if (!raw) return null;

  if (/^[0-9A-F]+$/i.test(raw) && /[A-F]/i.test(raw)) {
    const value = Number.parseInt(raw, 16);
    if (Number.isFinite(value)) {
      return normalizeDaCode(value);
    }
  }

  const numeric = Number.parseInt(raw, 10);
  if (Number.isFinite(numeric)) {
    return normalizeDaCode(numeric);
  }

  return normalizeDaCode(raw);
}

export function daCodeToEcuId(daCode: string): string {
  return toDaId(normalizeDaCode(daCode));
}

export function parseOdxStem(filename: string): {
  stem: string;
  prefix: string;
  revision: string | null;
} {
  const base = filename.replace(/\.(odx|xml)$/i, "");
  const match = base.match(/^(EV_[^_]+(?:_[^_]+)*?)_(\d{6})(?:_d)?$/i);
  if (match) {
    return {
      stem: base,
      prefix: match[1],
      revision: match[2],
    };
  }

  const bvMatch = base.match(/^(BV_[^_]+(?:_[^_]+)*?)_(\d{6})(?:_d)?$/i);
  if (bvMatch) {
    return {
      stem: base,
      prefix: bvMatch[1],
      revision: bvMatch[2],
    };
  }

  return { stem: base, prefix: base, revision: null };
}
