export interface ClassifiedCoverage {
  applicable: boolean;
  status: "pending" | "covered" | null;
}

/** Matches Excel H1/I1/J1: non-empty cells excluding *NP* markers. */
export function classifyCoverageCell(value: unknown): ClassifiedCoverage {
  if (value === null || value === undefined || value === "") {
    return { applicable: false, status: null };
  }

  const text = String(value).trim();
  if (/np/i.test(text)) {
    return { applicable: false, status: null };
  }

  const lower = text.toLowerCase();
  if (lower === "used") return { applicable: true, status: "covered" };
  if (lower === "x") return { applicable: true, status: "pending" };

  // Values such as "1" count toward the Excel total but are neither used nor x.
  return { applicable: true, status: null };
}

export function mapImportCoverage(value: unknown): "pending" | "covered" | null {
  return classifyCoverageCell(value).status;
}

export function parseGffAvailable(value: unknown): string | null {
  const text = cellString(value);
  if (!text) return null;
  return text.toLowerCase() === "y" ? "y" : null;
}

export function mapExportGffAvailable(value: string | null): string {
  return value === "y" ? "y" : "";
}

export function mapExportCoverage(
  value: string | null,
  applicable = false,
): string {
  if (!applicable) return "";
  if (value === "covered") return "used";
  if (value === "pending") return "x";
  return "1";
}

export function cellString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

export function normalizeDaCode(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return value.toString(16).toUpperCase().padStart(4, "0");
  }
  const text = String(value).trim().toUpperCase();
  if (/^\d+$/.test(text)) return text.padStart(4, "0");
  return text.replace(/^DA/, "");
}

export function toDaId(code: string): string {
  return `DA${code}`;
}
