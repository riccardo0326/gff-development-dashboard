export function mapImportCoverage(value: unknown): "pending" | "covered" | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim().toLowerCase();
  if (text === "used") return "covered";
  if (text === "x") return "pending";
  if (text.includes("np")) return null;
  return null;
}

export function mapExportCoverage(value: string | null): string {
  if (value === "covered") return "used";
  if (value === "pending") return "x";
  return "";
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
