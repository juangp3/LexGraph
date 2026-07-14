import { describe, expect, it } from "vitest";
import { normalizeRecord } from "../../src/import/normalizer.js";
import { validateRecord } from "../../src/import/validator.js";

describe("import validator", () => {
  it("rejects unsupported relation type", () => {
    const raw = {
      family: "Indo-European",
      language: "English",
      stage: "Modern English",
      word: "father",
      sourceTitle: "S",
      relationType: "UNKNOWN"
    };

    const normalized = normalizeRecord(raw);
    const errors = validateRecord(0, raw, normalized);
    expect(errors.some((error) => error.code === "INVALID_RELATION_TYPE")).toBe(true);
  });

  it("accepts valid evolved_from relation payload", () => {
    const raw = {
      family: "Indo-European",
      language: "English",
      stage: "Modern English",
      word: "father",
      sourceTitle: "S",
      relationType: "EVOLVED_FROM",
      relatedWord: "faeder",
      relatedLanguage: "English",
      relatedStage: "Old English"
    };

    const normalized = normalizeRecord(raw);
    const errors = validateRecord(0, raw, normalized);
    expect(errors.length).toBe(0);
  });
});
