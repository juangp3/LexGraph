# Provenance & Trust Implementation Plan

This plan turns the content of [docs/1.optmization.md](1.optmization.md) into a coordinated implementation roadmap for LexGraph.

## Guiding principle

Implement the system in layers so each workstream can ship independently while still building toward a provenance-first graph experience.

## Delivery phases

### Phase 0 — Provenance foundation
Goal: make every imported assertion explainable and replayable.

#### Workstream A — Schema and persistence
- Owner: Subagent A
- Scope:
  - Extend the Prisma schema with explicit provenance entities such as SourceVersion, ImportRun, Claim, and Evidence.
  - Preserve source licensing and attribution metadata.
  - Add indexes and constraints that support provenance lookup and auditing.
- Files:
  - [prisma/schema.prisma](../prisma/schema.prisma)
- Acceptance criteria:
  - Import runs can be created and linked to source/version metadata.
  - Claims and evidence records can be persisted for relationship assertions.
  - The schema supports replay and audit queries.

#### Workstream B — Import pipeline provenance capture
- Owner: Subagent B
- Scope:
  - Record source version, checksum, import status, record counts, and errors during imports.
  - Persist raw imported records and normalized outputs.
  - Attach provenance metadata to created or updated graph relationships.
- Files:
  - [src/import/importer.ts](../src/import/importer.ts)
  - [src/import/provenance.ts](../src/import/provenance.ts)
  - [src/import/job-store.ts](../src/import/job-store.ts)
- Acceptance criteria:
  - Every import run produces an auditable record.
  - Imported relationships can be traced back to a source/version and import run.
  - Failed or partial imports leave clear status and error metadata.

#### Workstream C — Graph repository provenance reads
- Owner: Subagent C
- Scope:
  - Add repository methods to fetch relationship provenance and evidence summaries.
  - Return confidence, disputed state, and source details in graph-aware queries.
- Files:
  - [src/repositories/pg-graph.repository.ts](../src/repositories/pg-graph.repository.ts)
  - [src/services/graph.service.ts](../src/services/graph.service.ts)
- Acceptance criteria:
  - Graph traversal responses include enough provenance detail for UI inspection.
  - Provenance reads are efficient and do not regress traversal latency.

### Phase 1 — Trust, conflict, and auditability
Goal: make the system distinguish between asserted, inferred, and disputed facts.

#### Workstream D — Confidence and contradiction handling
- Owner: Subagent D
- Scope:
  - Add confidence scoring and status flags to claims.
  - Detect contradictory claims and mark them as disputed or conflicting.
  - Expose normalized statuses in the API.
- Files:
  - [src/import/provenance.ts](../src/import/provenance.ts)
  - [src/app.ts](../src/app.ts)
- Acceptance criteria:
  - Contradictory evidence is discoverable through API metadata.
  - Low-confidence or disputed claims are clearly flagged.

#### Workstream E — Provenance API surface
- Owner: Subagent E
- Scope:
  - Add endpoints for provenance lookup, evidence details, and import history.
  - Support endpoint-level filtering by confidence and provenance state.
- Files:
  - [src/app.ts](../src/app.ts)
  - [src/routes](../src/routes)
- Acceptance criteria:
  - UI and admin tooling can request provenance for any relationship or word.
  - The API returns structured evidence information rather than only raw IDs.

### Phase 2 — Search and graph UX
Goal: turn provenance data into a visible and useful user experience.

#### Workstream F — Search trust metadata
- Owner: Subagent F
- Scope:
  - Extend search responses with confidence, source summary, and evidence summary.
  - Make search ranking aware of trust signals without breaking retrieval quality.
- Files:
  - [src/app.ts](../src/app.ts)
  - [src/repositories/pg-search.repository.ts](../src/repositories/pg-search.repository.ts)
- Acceptance criteria:
  - Search results expose provenance context in the response payload.
  - Trust-aware ranking can be toggled or tested independently.

#### Workstream G — Graph UI provenance panel
- Owner: Subagent G
- Scope:
  - Add a provenance drawer or side panel for nodes and edges.
  - Render source name, version, confidence, and disputed status.
  - Support evidence browsing from the graph canvas.
- Files:
  - [web/src/features/graph/GraphCanvas.tsx](../web/src/features/graph/GraphCanvas.tsx)
  - [web/src/features/graph/graph.service.ts](../web/src/features/graph/graph.service.ts)
- Acceptance criteria:
  - Selecting a node or edge shows provenance details.
  - Users can distinguish high-confidence from disputed or inferred data.

### Phase 3 — Validation, ops, and performance
Goal: make the implementation production-safe and measurable.

#### Workstream H — Replay, rollback, and validation
- Owner: Subagent H
- Scope:
  - Add import replay and checksum validation.
  - Support partial-failure recovery and rollback-safe imports.
- Files:
  - [src/import](../src/import)
  - [prisma/migrations](../prisma/migrations)
- Acceptance criteria:
  - An import can be rerun deterministically against the same source artifact.
  - Failed imports leave the database in a recoverable state.

#### Workstream I — Performance and regression gates
- Owner: Subagent I
- Scope:
  - Measure graph traversal, provenance reads, and search response time.
  - Add regression tests and baseline comparison for performance thresholds.
- Files:
  - [docs/performance.md](performance.md)
  - [tests/performance](../tests/performance)
- Acceptance criteria:
  - Provenance endpoints stay within the agreed latency targets.
  - Performance regressions fail the relevant CI gates.

## Suggested execution order

1. Schema + persistence
2. Import provenance capture
3. Graph repository provenance reads
4. Confidence and contradiction handling
5. Provenance API surface
6. Search trust metadata
7. Graph UI provenance panel
8. Replay/rollback and performance gates

## Definition of done

The implementation is complete when:
- provenance is captured for imported claims;
- graph and search results expose trust metadata;
- users can inspect why an edge exists and what evidence supports it;
- imports are replayable and auditable; and
- latency and regression gates remain within the documented targets.
