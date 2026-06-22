import * as XLSX from "xlsx";

export function excelDateToIso(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const mm = String(parsed.m).padStart(2, "0");
    const dd = String(parsed.d).padStart(2, "0");
    return `${parsed.y}-${mm}-${dd}`;
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

export function isoToExcelDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}
