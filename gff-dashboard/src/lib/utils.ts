import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function parseEcuCodeHex(code: string): number {
  const normalized = code.replace(/^DA/i, "").trim();
  const parsed = Number.parseInt(normalized, 16);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

export function compareEcuCodeHex(a: string, b: string): number {
  return parseEcuCodeHex(a) - parseEcuCodeHex(b);
}
