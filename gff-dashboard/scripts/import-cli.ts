import fs from "fs";
import path from "path";
import { importWorkbookFromBuffer } from "../src/lib/excel/import-workbook";

const xlsmPath =
  process.env.GFF_XLSM_PATH ??
  path.join(process.cwd(), "..", "GFF_development - internal copy.xlsm");

if (!fs.existsSync(xlsmPath)) {
  console.error(`Excel file not found: ${xlsmPath}`);
  process.exit(1);
}

const buffer = fs.readFileSync(xlsmPath);
const summary = importWorkbookFromBuffer(buffer);
console.log("Import complete:", summary);
