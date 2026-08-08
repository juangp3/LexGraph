# Phase 4 next-sprint implementation plan

## Sprint goal

Deliver the first production-ready slice of the Phase 4 platform: a resumable, provenance-aware import pipeline that stores raw and canonical data separately, tracks import jobs, and exposes the first operational metrics.

## Success criteria

By the end of the sprint, the project should be able to:

- run imports through a tracked job lifecycle
- preserve raw source records before normalization
- store provenance and confidence data for imported words and edges
- resume interrupted imports without duplicating work
- expose a basic import summary and error report
- keep existing graph and API behavior working

---

## Workstream 1: import job lifecycle

### Goal

Replace the current one-shot import flow with a job-based pipeline that can be restarted and monitored.

### Files to touch

- [prisma/schema.prisma](prisma/schema.prisma)
- [src/import/importer.ts](src/import/importer.ts)
- [src/import/types.ts](src/import/types.ts)
- [scripts/import-week4.ts](scripts/import-week4.ts)

### Tasks

1. Add Prisma models for import jobs, import runs, and raw staged records.
2. Refactor the importer so it creates a job record before processing starts.
3. Track status transitions: queued, running, completed, failed, canceled.
4. Persist per-record rejections and counts for accepted/rejected/upserted rows.
5. Add a resumable strategy that skips already-processed records based on persisted progress.

### Definition of done

- A single import command creates a job and stores progress in the database.
- Re-running the same import after a failure resumes safely.
- The output includes a persisted summary and rejection log.

---

## Workstream 2: raw staging and canonical separation

### Goal

Separate immutable raw source data from canonical normalized data.

### Files to touch

- [prisma/schema.prisma](prisma/schema.prisma)
- [src/import/importer.ts](src/import/importer.ts)
- [src/import/normalizer.ts](src/import/normalizer.ts)
- [src/import/validator.ts](src/import/validator.ts)

### Tasks

1. Add a raw-record table to store the original payload before any transformation.
2. Store a hash or checksum of each raw payload for deduplication and auditing.
3. Keep the current canonical tables, but link them to their corresponding raw record.
4. Ensure failed records remain visible for inspection instead of being silently dropped.

### Definition of done

- Every imported record has a persisted raw copy.
- Canonical records can be traced back to the originating raw payload.
- The importer no longer depends on ephemeral in-memory state for provenance history.

---

## Workstream 3: provenance and confidence model

### Goal

Move from simple source linkage to a richer provenance and confidence workflow.

### Files to touch

- [prisma/schema.prisma](prisma/schema.prisma)
- [src/import/types.ts](src/import/types.ts)
- [src/import/normalizer.ts](src/import/normalizer.ts)
- [src/import/validator.ts](src/import/validator.ts)
- [src/import/deduplicator.ts](src/import/deduplicator.ts)

### Tasks

1. Add confidence fields for words, meanings, and edges.
2. Introduce provenance metadata such as source locator, extracted by, and evidence summary.
3. Preserve conflicting values instead of overwriting them blindly.
4. Add a simple conflict classification: exact match, partial match, conflicting value.
5. Make deduplication aware of provenance so two records can be merged without losing evidence.

### Definition of done

- Each canonical entity stores its provenance and confidence.
- The importer can represent conflicts explicitly.
- The system can explain where a value came from.

---

## Workstream 4: edge and relationship quality

### Goal

Make the graph relationships more robust and more faithful to the proposal.

### Files to touch

- [prisma/schema.prisma](prisma/schema.prisma)
- [src/import/importer.ts](src/import/importer.ts)
- [src/services/graph.service.ts](src/services/graph.service.ts)
- [src/repositories/pg-graph.repository.ts](src/repositories/pg-graph.repository.ts)

### Tasks

1. Expand edge metadata to include relation type, confidence, evidence summary, and dispute flags.
2. Ensure the importer writes relationship evidence into the database rather than only creating the edge record.
3. Expose relationship confidence and evidence through the graph service layer.
4. Add a basic rule for “disputed” or “low-confidence” relationships in the graph output.

### Definition of done

- Graph edges carry enough metadata to support provenance-aware inspection.
- The graph API can surface confidence and evidence in a basic way.

---

## Workstream 5: operational monitoring and reporting

### Goal

Provide the first basic monitoring surface for import health.

### Files to touch

- [src/import/importer.ts](src/import/importer.ts)
- [src/db/client.ts](src/db/client.ts)
- [scripts/import-week4.ts](scripts/import-week4.ts)

### Tasks

1. Emit structured import summary data: processed, accepted, rejected, upserted words, upserted edges, duration.
2. Store a simple import statistics record per run.
3. Write a human-readable summary to the console and to a log file.
4. Create a basic report for the latest import failures.

### Definition of done

- A developer can inspect the last import run and see counts and failures quickly.
- The system provides the minimum operational visibility required for the next phase.

---

## Workstream 6: tests and regression protection

### Goal

Protect the new import behavior with repeatable automated coverage.

### Files to touch

- [tests/integration/import.pipeline.integration.test.ts](tests/integration/import.pipeline.integration.test.ts)
- [tests/unit/import-validator.test.ts](tests/unit/import-validator.test.ts)
- [tests/unit/normalizer.test.ts](tests/unit/normalizer.test.ts)
- [tests/fixtures/week4-import-dataset.json](tests/fixtures/week4-import-dataset.json)

### Tasks

1. Add a failing integration test for job-based imports.
2. Add tests for resumable behavior after a simulated interruption.
3. Add tests for provenance and conflict metadata persistence.
4. Add tests that ensure raw records are stored before canonical upserts.

### Definition of done

- The new workflow is covered by integration tests.
- Import regressions are caught before release.

---

## Suggested sprint sequence

### Week 1

- schema extension for import jobs and raw-staging records
- importer refactor to support job lifecycle and progress tracking
- basic summary and rejection persistence

### Week 2

- provenance and confidence metadata
- edge metadata and graph exposure
- monitoring report and regression tests

---

## Recommended implementation order

1. import job models and execution lifecycle
2. raw staging persistence
3. provenance and confidence metadata
4. conflict handling and deduplication improvements
5. monitoring and tests

---

## Risks to watch

- schema changes may require a fresh migration and data backfill
- resumable imports need careful transaction boundaries to avoid duplicate writes
- confidence and provenance fields should stay backward-compatible with the current importer
- overbuilding the model now will slow delivery; keep the first slice focused on the highest-value pieces
