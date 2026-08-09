import { describe, expect, it } from "vitest";
import { summarizeProvenance } from "../../src/import/provenance.js";

describe("provenance summary", () => {
  it("collapses multiple evidence entries into one confidence-aware summary", () => {
    const summary = summarizeProvenance([
      {
        confidence: 0.95,
        evidenceSummary: "Source: Wiktionary | Locator: p.1",
        createdBy: "week4-import",
        isDisputed: false,
        sourceTitle: "Wiktionary",
      },
      {
        confidence: 0.72,
        evidenceSummary: "Source: Dictionary | Locator: entry-2",
        createdBy: "week4-import",
        isDisputed: true,
        sourceTitle: "Dictionary",
      },
    ]);

    expect(summary.confidence).toBe(0.95);
    expect(summary.evidenceSummary).toContain("Wiktionary");
    expect(summary.evidenceSummary).toContain("Dictionary");
    expect(summary.isDisputed).toBe(true);
    expect(summary.sourceCount).toBe(2);
    expect(summary.sourceTitles).toEqual(["Wiktionary", "Dictionary"]);
  });
});
