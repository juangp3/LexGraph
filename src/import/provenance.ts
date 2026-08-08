export interface ProvenanceMetadata {
  confidence: number;
  evidenceSummary: string;
  createdBy: string;
}

export type ConflictType = "exact-match" | "partial-match" | "conflicting-value";

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
