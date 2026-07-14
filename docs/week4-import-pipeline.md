# Week 4 Import Pipeline

## Delivered Components

- Parser interface: src/import/parser.interface.ts
- First adapter: src/import/adapters/local-json.parser.ts
- Normalizer: src/import/normalizer.ts
- Validator: src/import/validator.ts
- Deduplicator: src/import/deduplicator.ts
- Orchestrator: src/import/importer.ts
- Runner script: scripts/import-week4.ts

## Input Dataset

- tests/fixtures/week4-import-dataset.json

This dataset includes:

- valid lineage records
- duplicate records for dedup testing
- invalid records for rejection logging

## Pipeline Stages

1. Parse JSON adapter input.
2. Normalize text and relation fields.
3. Validate required fields and relation contracts.
4. Deduplicate canonical records.
5. Upsert relational entities and source attribution.
6. Upsert graph relations and edge provenance.
7. Persist machine-readable rejection logs in ndjson format.

## Idempotency

The importer uses conflict-safe writes and existing-record lookups so reruns do not duplicate words or edges.

## Rejection Logs

Default path:

- logs/import-rejections.ndjson

Each line is structured JSON with:

- index
- code
- message
- record
