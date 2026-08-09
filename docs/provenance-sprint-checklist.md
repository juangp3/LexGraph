# Provenance & Trust Sprint Checklist

This checklist breaks the provenance implementation plan into sprint-sized work items that can be assigned to subagents.

## Sprint 1 — Provenance foundation

### Subagent A — Database schema and persistence
Files:
- [prisma/schema.prisma](../prisma/schema.prisma)
- [prisma/migrations](../prisma/migrations)

Tasks:
- Add a first-class provenance model for source versions, import runs, claims, and evidence.
- Add fields for source licensing, attribution, and version metadata.
- Add indexes that support audits and provenance lookups.
- Create migration(s) for the new tables and relations.

Acceptance criteria:
- The schema supports storing source/version metadata, import runs, claims, and evidence.
- Existing import and graph data can be migrated without data loss.
- Queries can retrieve provenance for a specific relationship or word.

### Subagent B — Import pipeline provenance capture
Files:
- [src/import/importer.ts](../src/import/importer.ts)
- [src/import/provenance.ts](../src/import/provenance.ts)
- [src/import/job-store.ts](../src/import/job-store.ts)
- [src/import](../src/import)

Tasks:
- Capture source version and import run identifiers during import.
- Record record counts, status, checksum, and failure details for each import run.
- Persist raw source records and normalized output for replay/debugging.
- Attach provenance metadata to created or updated relationships.

Acceptance criteria:
- Every import run creates a durable record with status and counts.
- Imported relationships can be traced to an import run and source version.
- Failed imports leave structured error metadata for debugging.

### Subagent C — Graph repository provenance reads
Files:
- [src/repositories/pg-graph.repository.ts](../src/repositories/pg-graph.repository.ts)
- [src/services/graph.service.ts](../src/services/graph.service.ts)
- [src/repositories/interfaces.ts](../src/repositories/interfaces.ts)

Tasks:
- Add repository methods to load provenance summary data for graph edges and nodes.
- Return confidence, status, and source information in traversal responses.
- Keep the graph traversal path efficient and avoid N+1 behavior.

Acceptance criteria:
- Graph traversal responses include provenance context for visible edges.
- Provenance reads remain within performance targets for depth 2 and depth 3 traversal.
- Repository unit tests cover provenance-enabled graph queries.

## Sprint 2 — Trust and auditability

### Subagent D — Confidence and contradiction model
Files:
- [src/import/provenance.ts](../src/import/provenance.ts)
- [src/domain](../src/domain)
- [src/repositories](../src/repositories)

Tasks:
- Add confidence values and claim status flags (asserted, inferred, disputed, rejected).
- Add contradiction detection logic for duplicate or conflicting claims.
- Normalize the way trust states are represented across import and graph layers.

Acceptance criteria:
- Conflicting claims are stored as distinct evidence with a clear disputed state.
- The API can expose whether a claim is high-confidence, disputed, or inferred.
- Unit tests cover contradiction and confidence behavior.

### Subagent E — Provenance API surface
Files:
- [src/app.ts](../src/app.ts)
- [src/routes](../src/routes)
- [src/controllers](../src/controllers)

Tasks:
- Add endpoints to retrieve provenance for a word, relationship, or edge.
- Add endpoints to retrieve import-run history and evidence details.
- Support filtering by confidence or trust status.

Acceptance criteria:
- Clients can request provenance details for a specific graph relationship.
- Import history can be retrieved via API without database-level manual inspection.
- API responses are structured and documented in the code path.

## Sprint 3 — Search and graph UX

### Subagent F — Search trust metadata
Files:
- [src/app.ts](../src/app.ts)
- [src/repositories/pg-search.repository.ts](../src/repositories/pg-search.repository.ts)
- [src/repositories/interfaces.ts](../src/repositories/interfaces.ts)

Tasks:
- Extend search responses with confidence and evidence summaries.
- Add trust-aware ranking options or metadata fields without breaking existing search behavior.
- Ensure the response contract remains backward-compatible.

Acceptance criteria:
- Search results include provenance context in the JSON payload.
- Existing search callers continue to work with no breaking change.
- Search tests cover the new metadata fields.

### Subagent G — Graph UI provenance panel
Files:
- [web/src/features/graph/GraphCanvas.tsx](../web/src/features/graph/GraphCanvas.tsx)
- [web/src/features/graph/graph.service.ts](../web/src/features/graph/graph.service.ts)
- [web/src/features/graph](../web/src/features/graph)

Tasks:
- Add a provenance panel or drawer for node and edge selection.
- Render source name, version, confidence, and disputed status.
- Allow users to see supporting evidence and import-run context.

Acceptance criteria:
- Selecting a node or edge shows provenance and evidence details in the UI.
- The panel is accessible and does not break graph interaction.
- Component tests cover empty, disputed, and high-confidence states.

## Sprint 4 — Validation, ops, and performance

### Subagent H — Replay and rollback safety
Files:
- [src/import](../src/import)
- [prisma/migrations](../prisma/migrations)
- [scripts](../scripts)

Tasks:
- Add replay support for import runs using source artifact checksums.
- Add rollback-safe import behavior for partial failures.
- Provide a simple admin command or endpoint for rerunning imports.

Acceptance criteria:
- An import can be rerun deterministically against the same source artifact.
- Failed imports do not leave partial graph state without clear recovery metadata.
- The import workflow can be rerun without manual database cleanup.

### Subagent I — Performance and regression gates
Files:
- [docs/performance.md](performance.md)
- [tests/performance](../tests/performance)
- [package.json](../package.json)

Tasks:
- Add or extend benchmark scripts for provenance and graph traversal latency.
- Add regression thresholds for provenance API and traversal endpoints.
- Track p95 latency and compare with baseline values.

Acceptance criteria:
- Provenance endpoints stay within the documented performance targets.
- Perf regression tests fail CI when thresholds are exceeded.
- Benchmarks can be run locally with the documented commands.
