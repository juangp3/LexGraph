-- Week 3 graph core with provenance.

CREATE TABLE IF NOT EXISTS etymology_edges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_word_id uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  to_word_id uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  confidence numeric(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence_summary text,
  method text NOT NULL,
  is_disputed boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (relation_type IN ('EVOLVED_FROM', 'BORROWED_FROM', 'COGNATE_WITH')),
  CHECK (method IN ('manual', 'imported', 'inferred')),
  CHECK (from_word_id <> to_word_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_etymology_edges_from_to_type
  ON etymology_edges(from_word_id, to_word_id, relation_type);

CREATE INDEX IF NOT EXISTS idx_etymology_edges_to_type
  ON etymology_edges(to_word_id, relation_type);

CREATE INDEX IF NOT EXISTS idx_etymology_edges_type
  ON etymology_edges(relation_type);

CREATE TABLE IF NOT EXISTS edge_sources (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  edge_id uuid NOT NULL REFERENCES etymology_edges(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  source_locator text,
  quote_excerpt text,
  confidence_delta numeric(3,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (confidence_delta IS NULL OR (confidence_delta >= 0 AND confidence_delta <= 1))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_edge_sources_edge_source_locator
  ON edge_sources(edge_id, source_id, COALESCE(source_locator, ''));

CREATE INDEX IF NOT EXISTS idx_edge_sources_source_id
  ON edge_sources(source_id);
