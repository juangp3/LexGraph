export interface SearchCacheKeyInput {
  query: string;
  language?: string;
  family?: string;
  type?: string;
  datasetVersion?: string;
  limit: number;
}

function normalize(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function searchCacheKey(input: SearchCacheKeyInput): string {
  const parts = [
    'search:v1',
    normalize(input.query),
    normalize(input.language),
    normalize(input.family),
    normalize(input.type),
    normalize(input.datasetVersion),
    String(input.limit),
  ];

  return parts.join(':');
}

export function wordDetailCacheKey(wordId: string): string {
  return `word:v1:${wordId}`;
}

export interface GraphExpandCacheKeyInput {
  entityId: string;
  direction: string;
  depth: number;
  relationshipTypes?: string[];
  entityTypes?: string[];
  limit: number;
  cursor?: string;
}

export function graphExpandCacheKey(input: GraphExpandCacheKeyInput): string {
  const relationship = (input.relationshipTypes ?? []).map((item) => item.toLowerCase()).sort().join(',');
  const entityTypes = (input.entityTypes ?? []).map((item) => item.toLowerCase()).sort().join(',');

  return [
    'graph-expand:v1',
    input.entityId,
    input.direction.toLowerCase(),
    String(input.depth),
    relationship,
    entityTypes,
    String(input.limit),
    input.cursor ?? '',
  ].join(':');
}
