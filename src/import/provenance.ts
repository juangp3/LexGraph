export interface ProvenanceMetadata {
  confidence: number;
  evidenceSummary: string;
  createdBy: string;
}

export interface ProvenanceSummary extends ProvenanceMetadata {
  isDisputed: boolean;
  sourceCount: number;
  sourceTitles: string[];
}

export type ConflictType = "exact-match" | "partial-match" | "conflicting-value";

interface ProvenanceEvidenceLike {
  confidence: number;
  evidenceSummary: string;
  createdBy: string;
  isDisputed?: boolean;
  sourceTitle?: string | null;
}

export function buildProvenanceMetadata(record: Record<string, unknown>): ProvenanceMetadata {
  const sourceTitle = typeof record.sourceTitle === "string" ? record.sourceTitle : "unknown";
  const sourceLocator = typeof record.sourceLocator === "string" ? record.sourceLocator : null;
  const relationType = typeof record.relationType === "string" ? record.relationType : null;

  return {
    confidence: 0.9,
    evidenceSummary: [
      `Source: ${sourceTitle}`,
      relationType ? `Relation: ${relationType}` : null,
      sourceLocator ? `Locator: ${sourceLocator}` : null
    ]
      .filter(Boolean)
      .join(" | "),
    createdBy: "week4-import"
  };
}

export function summarizeProvenance(entries: ProvenanceEvidenceLike[]): ProvenanceSummary {
  const normalized = entries.filter(Boolean);
  const bestConfidence = normalized.reduce<number | null>((best, entry) => {
    if (best === null || entry.confidence > best) {
      return entry.confidence;
    }
    return best;
  }, null);

  const sourceTitles = normalized
    .map((entry) => entry.sourceTitle?.trim())
    .filter((value): value is string => Boolean(value));

  return {
    confidence: bestConfidence ?? 0.5,
    evidenceSummary: normalized
      .map((entry) => entry.evidenceSummary)
      .filter(Boolean)
      .join(" | "),
    createdBy: normalized[0]?.createdBy ?? "week4-import",
    isDisputed: normalized.some((entry) => entry.isDisputed),
    sourceCount: sourceTitles.length,
    sourceTitles,
  };
}

export function classifyConflictValues(existingValue: string | null | undefined, incomingValue: string | null | undefined): ConflictType {
  if (!existingValue || !incomingValue) {
    return "exact-match";
  }

  if (existingValue === incomingValue) {
    return "exact-match";
  }

  const normalizedExisting = existingValue.trim().toLowerCase();
  const normalizedIncoming = incomingValue.trim().toLowerCase();

  const existingTokens = normalizedExisting.split(/\s+/).filter(Boolean);
  const incomingTokens = normalizedIncoming.split(/\s+/).filter(Boolean);

  const shorter = existingTokens.length <= incomingTokens.length ? existingTokens : incomingTokens;
  const longer = existingTokens.length <= incomingTokens.length ? incomingTokens : existingTokens;

  if (shorter.length === 1 && longer.includes(shorter[0])) {
    return "partial-match";
  }

  if (existingTokens.some((token) => incomingTokens.includes(token))) {
    return "conflicting-value";
  }

  return "conflicting-value";
}
