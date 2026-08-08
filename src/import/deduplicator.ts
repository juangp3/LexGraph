import type { NormalizedImportRecord } from "./types.js";
import { classifyConflictValues } from "./provenance.js";

export interface DedupResult {
  unique: NormalizedImportRecord[];
  duplicateIndexes: number[];
}

export function deduplicateRecords(records: NormalizedImportRecord[]): DedupResult {
  const unique: NormalizedImportRecord[] = [];
  const duplicateIndexes: number[] = [];
  const seen = new Map<string, NormalizedImportRecord>();

  records.forEach((record, index) => {
    const key = [
      record.language,
      record.stage,
      record.wordNormalized,
      record.sourceTitle
    ].join("|");

    const existing = seen.get(key);
    if (existing) {
      duplicateIndexes.push(index);
      const conflictType = classifyConflictValues(existing.meaning, record.meaning);
      const conflictDetails = conflictType === "conflicting-value"
        ? `meaning changed from "${existing.meaning}" to "${record.meaning}"`
        : undefined;

      if (conflictType === "conflicting-value") {
        existing.conflictType = "conflicting-value";
        existing.conflictDetails = conflictDetails;
      }
      return;
    }

    seen.set(key, record);
    unique.push(record);
  });

  return { unique, duplicateIndexes };
}
