export interface GraphSource {
  sourceId: string;
  sourceLocator?: string | null;
  quoteExcerpt?: string | null;
  confidenceDelta?: number | null;
}

export interface GraphTraversalEdge {
  edgeId: string;
  fromWordId: string;
  toWordId: string;
  relationType: string;
  confidence: number;
  method: string;
  isDisputed: boolean;
  evidenceSummary?: string | null;
  depth: number;
  path: string[];
  sources: GraphSource[];
  provenance?: {
    confidence: number;
    evidenceSummary: string;
    sourceCount: number;
    sourceTitles: string[];
    isDisputed: boolean;
  };
}

export interface GraphTraversalResponse {
  wordId: string;
  depth: number;
  edges: GraphTraversalEdge[];
}

export interface GraphWordDetailsResponse {
  wordId: string;
  textOriginal: string;
  textNormalized?: string;
  language: string;
  stage?: string | null;
}
