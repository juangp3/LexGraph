# LexGraph Minimal Schema Proposal

## Goals

- Keep relational data authoritative for identity, provenance, and indexing.
- Use Apache AGE for traversal and graph-centric queries.
- Make uncertainty explicit with confidence and evidence metadata.
- Enforce repository boundaries so controllers never execute SQL or Cypher directly.

## Modeling Principles

1. Canonical identity lives in relational tables.
2. Graph nodes reference relational IDs.
3. Every edge must be attributable to at least one source.
4. COGNATE_WITH is symmetric by meaning, but stored as directed pairs with canonical ordering rules.
5. Uncertain data is first-class, never hidden.

## Relational Tables (MVP)

### language_families

- id (uuid, pk)
- name (text, not null)
- slug (text, not null, unique)
- parent_family_id (uuid, nullable, fk -> language_families.id)
- created_at (timestamptz, not null, default now())
- updated_at (timestamptz, not null, default now())

Indexes

- unique(slug)
- index(parent_family_id)

### languages

- id (uuid, pk)
- family_id (uuid, nullable, fk -> language_families.id)
- name (text, not null)
- iso639_3 (text, nullable)
- stage_label (text, nullable) // Example: Old English, Proto-Germanic
- period_start (int, nullable)
- period_end (int, nullable)
- created_at (timestamptz, not null, default now())
- updated_at (timestamptz, not null, default now())

Indexes

- index(family_id)
- index(iso639_3)
- unique(name, stage_label)

### sources

- id (uuid, pk)
- title (text, not null)
- author (text, nullable)
- year (int, nullable)
- url (text, nullable)
- license (text, nullable)
- citation (text, nullable)
- created_at (timestamptz, not null, default now())
- updated_at (timestamptz, not null, default now())

Indexes

- index(year)

### words

- id (uuid, pk)
- language_id (uuid, not null, fk -> languages.id)
- text_original (text, not null)
- text_normalized (text, not null)
- text_ascii_folded (text, not null)
- lemma (text, nullable)
- ipa (text, nullable)
- is_reconstructed (boolean, not null, default false)
- reconstruction_marker (text, nullable) // Example: leading asterisk handling
- period_label (text, nullable)
- notes (text, nullable)
- created_at (timestamptz, not null, default now())
- updated_at (timestamptz, not null, default now())

Indexes

- unique(language_id, text_normalized, coalesce(lemma, ''))
- gin(text_normalized gin_trgm_ops)
- gin(text_ascii_folded gin_trgm_ops)
- index(language_id)
- index(is_reconstructed)

### meanings

- id (uuid, pk)
- word_id (uuid, not null, fk -> words.id)
- gloss (text, not null)
- domain (text, nullable)
- usage_note (text, nullable)
- created_at (timestamptz, not null, default now())
- updated_at (timestamptz, not null, default now())

Indexes

- index(word_id)
- gin(gloss gin_trgm_ops)

### word_sources

Purpose

- Associates words with supporting references.

Columns

- id (uuid, pk)
- word_id (uuid, not null, fk -> words.id)
- source_id (uuid, not null, fk -> sources.id)
- source_locator (text, nullable) // page, section, entry id
- extracted_by (text, nullable) // adapter or curator id
- confidence (numeric(3,2), not null, default 1.00)
- created_at (timestamptz, not null, default now())

Indexes

- unique(word_id, source_id, coalesce(source_locator, ''))
- index(source_id)

### etymology_edges

Purpose

- Canonical relational representation of graph relationships with provenance.
- AGE edges can be derived from this table and kept in sync.

Columns

- id (uuid, pk)
- from_word_id (uuid, not null, fk -> words.id)
- to_word_id (uuid, not null, fk -> words.id)
- relation_type (text, not null)
- confidence (numeric(3,2), not null)
- evidence_summary (text, nullable)
- method (text, not null) // manual, imported, inferred
- is_disputed (boolean, not null, default false)
- created_by (text, nullable)
- created_at (timestamptz, not null, default now())
- updated_at (timestamptz, not null, default now())

Constraints

- check(relation_type in ('EVOLVED_FROM', 'BORROWED_FROM', 'COGNATE_WITH'))
- check(confidence >= 0 and confidence <= 1)
- check(from_word_id <> to_word_id)

Indexes

- unique(from_word_id, to_word_id, relation_type)
- index(to_word_id, relation_type)
- index(relation_type)

### edge_sources

Purpose

- Many-to-many evidence for etymology edges.

Columns

- id (uuid, pk)
- edge_id (uuid, not null, fk -> etymology_edges.id)
- source_id (uuid, not null, fk -> sources.id)
- source_locator (text, nullable)
- quote_excerpt (text, nullable)
- confidence_delta (numeric(3,2), nullable)
- created_at (timestamptz, not null, default now())

Indexes

- unique(edge_id, source_id, coalesce(source_locator, ''))
- index(source_id)

## Apache AGE Graph Design (MVP)

Graph name

- lexgraph

Node labels

- Word
- Language
- LanguageFamily
- Source

Edge labels

- EVOLVED_FROM
- BORROWED_FROM
- COGNATE_WITH
- BELONGS_TO_LANGUAGE
- IN_FAMILY
- ATTESTED_IN

Node properties (Word)

- rel_id (uuid string)
- text_original
- text_normalized
- language_id
- is_reconstructed

Edge properties (etymology)

- rel_id (uuid string from etymology_edges.id)
- confidence
- method
- is_disputed
- created_at

Important

- AGE graph is query-optimized projection, not sole source of truth.
- Source of truth for provenance is relational: etymology_edges plus edge_sources.

## Synchronization Strategy

Write path

1. Upsert relational entities.
2. Write etymology_edges and edge_sources in one transaction.
3. Project to AGE graph (upsert nodes/edges).

Read path

1. Use AGE for traversal IDs and topology.
2. Hydrate detailed metadata from relational tables by rel_id.
3. Return composed response with path plus evidence.

Failure handling

- If AGE projection fails, mark projection_pending flag (future column) and retry asynchronously.

## Repository Layer Contracts

### WordRepository

- upsertWord(input)
- findByNormalized(languageId, textNormalized, lemma)
- attachSource(wordId, sourceRef)

### GraphRepository

- upsertEdge(input)
- findAncestors(wordId, depth)
- findDescendants(wordId, depth)
- findBorrowings(wordId, depth)
- findCognates(wordId, depth)

### SearchRepository

- searchCandidates(query, languageFilter, limit)
- rankCandidates(candidates, query)

Rules

- Controllers call services.
- Services call repositories.
- Repositories own all SQL and Cypher.

## Minimal Prisma Mapping Guidance

Prisma should manage relational tables listed above.

Use raw SQL migrations (or migration hooks) for:

- AGE extension setup
- Cypher helper functions
- trigram and unaccent index specifics where Prisma DSL is insufficient

## API Response Shape (Example)

Graph traversal response should include:

- root_word
- nodes[]
- edges[]
- edge_evidence[]
- warnings[] for disputed or low-confidence relationships

Each edge payload should include:

- id
- relation_type
- from_word_id
- to_word_id
- confidence
- method
- is_disputed
- sources[] with locator and excerpt where available

## Initial Data Integrity Checks

Run in CI or nightly jobs:

1. Orphan edge check: all from_word_id and to_word_id must exist.
2. Source coverage check: every etymology edge has at least one edge_sources row.
3. Confidence range check: all confidence fields in [0, 1].
4. Duplicate symmetry check for cognates according to canonical ordering rule.

## Canonical Ordering Rule For COGNATE_WITH

To avoid duplicate mirror edges:

- Only store one direction where from_word_id lexically less than to_word_id.
- Query layer can materialize undirected behavior.

## Migration Order Recommendation

1. Create core relational tables.
2. Add constraints and indexes.
3. Seed minimal language and source data.
4. Enable AGE and create graph.
5. Backfill AGE nodes from words/languages/sources.
6. Backfill AGE etymology edges from etymology_edges.
