import type { ImportRejection, NormalizedImportRecord, RawImportRecord } from "./types.js";

export function validateRecord(
  index: number,
  raw: RawImportRecord,
  record: NormalizedImportRecord
): ImportRejection[] {
  const errors: ImportRejection[] = [];

  const required: Array<[keyof RawImportRecord, string]> = [
    ["family", "family is required"],
    ["language", "language is required"],
    ["stage", "stage is required"],
    ["word", "word is required"],
    ["sourceTitle", "sourceTitle is required"]
  ];

  for (const [field, message] of required) {
    const value = raw[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push({
        index,
        code: "REQUIRED_FIELD_MISSING",
        message,
        record: raw
      });
    }
  }

  if (raw.relationType && !record.relationType) {
    errors.push({
      index,
      code: "INVALID_RELATION_TYPE",
      message: `Unsupported relationType: ${raw.relationType}`,
      record: raw
    });
  }

  if (record.relationType && !record.relatedWordOriginal) {
    errors.push({
      index,
      code: "RELATED_WORD_REQUIRED",
      message: "relatedWord is required when relationType is provided",
      record: raw
    });
  }

  if (record.relationType && (!record.relatedLanguage || !record.relatedStage)) {
    errors.push({
      index,
      code: "RELATED_LANGUAGE_STAGE_REQUIRED",
      message: "relatedLanguage and relatedStage are required when relationType is provided",
      record: raw
    });
  }

  return errors;
}
