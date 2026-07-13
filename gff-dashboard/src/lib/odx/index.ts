export {
  parseOdxBuffer,
  mergeSnapshots,
} from "./parse-odx";
export { extractOdxEntries } from "./archive";
export { computeEvUpdateDiff } from "./diff";
export { parseOdxUpload, runEvUpdate, applyEvUpdateDiff } from "./sync";
export type {
  EvUpdateDiff,
  EvUpdateResult,
  ParsedOdxSnapshot,
  EcuSoftwareChange,
  DtcDiffEntry,
  EvDiffChangeType,
} from "./types";
