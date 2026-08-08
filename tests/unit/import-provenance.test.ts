import { describe, expect, it } from "vitest";
import { deduplicateRecords } from "../../src/import/deduplicator.js";
import { buildProvenanceMetadata, classifyConflictValues } from "../../src/import/provenance.js";

describe("import provenance", () => {
  it("builds consistent evidence and confidence metadata from a normalized record", () => {
    const metadata = buildProvenanceMetadata({
      family: "Indo-European",
      familySlug: "indo-european",
      language: "English",
      stage: "Modern English",
      wordOriginal: "father",
      wordNormalized: "father",
      wordAsciiFolded: "father",
      meaning: "male parent",
      sourceTitle: "Fixture Source",
      sourceAuthor: "Example Author",
      sourceYear: 2024,
      sourceUrl: "https://example.test",
      sourceLocator: "p.1",
      relationType: "EVOLVED_FROM",
      relatedWordOriginal: "faeder",
      relatedWordNormalized: "faeder",
      relatedWordAsciiFolded: "faeder",
      relatedLanguage: "Old English",
      relatedStage: "Old English"
    } as never);

    expect(metadata.confidence).toBe(0.9);
    expect(metadata.evidenceSummary).toContain("Fixture Source");
    expect(metadata.evidenceSummary).toContain("p.1");
    expect(metadata.createdBy).toBe("week4-import");
  });

  it("classifies exact, partial, and conflicting values", () => {
    expect(classifyConflictValues("father", "father")).toBe("exact-match");
    expect(classifyConflictValues("male parent", "parent")).toBe("partial-match");
    expect(classifyConflictValues("male parent", "female parent")).toBe("conflicting-value");
  });

  it("marks conflicting duplicates without dropping the retained record", () => {
    const baseRecord = {
      family: "Indo-European",
      familySlug: "indo-european",
      language: "English",
      stage: "Modern English",
      wordOriginal: "father",
      wordNormalized: "father",
      wordAsciiFolded: "father",
      meaning: "male parent",
      sourceTitle: "Fixture Source",
      sourceAuthor: "Example Author",
      sourceYear: 2024,
      sourceUrl: "https://example.test",
      sourceLocator: "p.1",
      relationType: null,
      relatedWordOriginal: null,
      relatedWordNormalized: null,
      relatedWordAsciiFolded: null,
      relatedLanguage: null,
      relatedStage: null
    } as Parameters<typeof deduplicateRecords>[0][number];

    const result = deduplicateRecords([
      baseRecord,
      { ...baseRecord, meaning: "female parent", sourceLocator: "p.2", sourceTitle: "Fixture Source" },
      { ...baseRecord, meaning: "male parent", sourceLocator: "p.3", sourceTitle: "Fixture Source" }
    ]);

    expect(result.unique).toHaveLength(1);
    expect(result.duplicateIndexes).toEqual([1, 2]);
    expect(result.unique[0].conflictType).toBe("conflicting-value");
    expect(result.unique[0].conflictDetails).toContain("meaning changed from \"male parent\" to \"female parent\"");
  });
});
