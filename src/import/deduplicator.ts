import type { NormalizedImportRecord } from "./types.js";

export interface DedupResult {
  unique: NormalizedImportRecord[];
  duplicateIndexes: number[];
}

export function deduplicateRecords(records: NormalizedImportRecord[]): DedupResult {
  const unique: NormalizedImportRecord[] = [];
  const duplicateIndexes: number[] = [];
  const seen = new Set<string>();

  records.forEach((record, index) => {
    const key = [
      record.language,
      record.stage,
      record.wordNormalized,
      record.sourceTitle,
      record.sourceLocator ?? ""
    ].join("|");

    if (seen.has(key)) {
      duplicateIndexes.push(index);
      return;
    }

    seen.add(key);
    unique.push(record);
  });

  return { unique, duplicateIndexes };
}
