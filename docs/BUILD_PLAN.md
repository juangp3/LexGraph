# LexGraph Build Plan (6 Weeks)

## Objective
Deliver an MVP that proves three things:

1. We can ingest real linguistic data into a normalized relational model.
2. We can traverse etymological relationships as a graph with provenance.
3. We can serve useful search and lineage endpoints with stable performance.

This plan intentionally excludes community features, embeddings, advanced analytics, and external search engines.

## Scope (In)

- PostgreSQL 17 with Apache AGE
- Prisma-managed relational schema and migrations
- Core entities: language families, languages, words, meanings, sources
- Core graph relationships: EVOLVED_FROM, BORROWED_FROM, COGNATE_WITH
- Provenance metadata for every relationship
- Import pipeline with one source adapter for MVP
- Search normalization and ranked candidate retrieval
- Ancestor and descendant graph traversal endpoints

## Scope (Out)

- Public collections, notes, social annotations
- Multi-provider AI generation
- Vector embeddings and semantic retrieval
- OpenSearch or Meilisearch
- Complex moderation workflows

## Architecture Decisions

- Single database: PostgreSQL + AGE
- Relational-first indexing and identity management
- Graph traversal through a dedicated repository layer
- No SQL or Cypher in controllers
- Domain services orchestrate repositories and enforce rules

## Workstreams

- Platform: Docker, database bootstrapping, extension setup, CI checks
- Data: relational schema, constraints, provenance rules
- Graph: AGE setup, node-edge mapping, traversal queries
- Ingestion: parser, normalizer, validator, deduplicator, writer
- API: search and graph endpoints with contract tests
- Quality: performance budgets, test fixtures, smoke tests

## Milestones And Acceptance Criteria

### Week 1: Foundation And Guardrails

Deliverables

- Docker Compose for postgres, apache-age, redis, api
- Local bootstrap scripts for DB and required extensions
- Initial Prisma project and first migration skeleton
- Repository interfaces defined (WordRepository, GraphRepository, SearchRepository)
- Test stack creation (tooling selection, folder structure, fixtures, and CI test jobs)

Acceptance criteria

- New developer can start stack and run first migration in less than 15 minutes
- All required extensions are enabled in the target DB
- API project compiles with repository interfaces and test stubs
- Test commands exist for unit, component, integration, and functional suites
- CI executes at least unit and component tests on every pull request

Exit risks to watch

- AGE extension installation differences across host environments
- Drift between Docker image versions and local expectations

### Week 2: Relational Core

Deliverables

- Tables for language_family, language, word, meaning, source
- Junctions and constraints for source attribution
- Canonical normalization fields and indexes
- Seed fixtures for at least one language lineage example

Acceptance criteria

- Duplicate canonical words in same language are blocked by constraints
- Word can be traced to one or more sources via relational joins
- Seed data supports at least one complete lineage chain

Exit risks to watch

- Under-specified uniqueness rules for reconstructed forms
- Missing nullable strategy for uncertain historical metadata

### Week 3: Graph Core With Provenance

Deliverables

- AGE graph initialization and schema conventions
- Node mapping strategy from relational entities
- Edge relationship contract with confidence and evidence fields
- GraphRepository methods:
  - findAncestors
  - findDescendants
  - findBorrowings
  - findCognates

Acceptance criteria

- Traversal endpoints return ordered paths with source references
- Every returned edge includes confidence and provenance payload
- Cycles are handled safely (depth caps, visited guards, or both)

Exit risks to watch

- Graph and relational ID mapping inconsistencies
- Ambiguous semantics between COGNATE_WITH and BORROWED_FROM

### Week 4: Import Pipeline MVP

Deliverables

- Parser interface and first adapter (for one source dataset)
- Normalizer for case, accents, and Unicode form
- Validator for required fields and relationship type checks
- Deduplicator and upsert strategy for relational + graph writes

Acceptance criteria

- Import of a representative sample succeeds repeatably
- Re-running import does not create duplicate words or duplicate edges
- Rejected records are logged with machine-readable reasons

Exit risks to watch

- Source-specific quirks leaking outside parser adapter
- Incomplete dedup keys causing silent data fragmentation

### Week 5: Search And API Contracts

Deliverables

- Search pipeline using unaccent + pg_trgm + ranking strategy
- Endpoint contracts:
  - search words
  - get word details
  - get ancestry graph
  - get descendant graph
- DTOs that expose normalized text and confidence metadata

Acceptance criteria

- Queries for father/Father/fader/fæder return stable relevant candidates
- P95 search latency under 250 ms on MVP dataset and local dev hardware
- API responses are deterministic for fixed fixtures

Exit risks to watch

- Relevance scoring not matching linguistic expectations
- Overly expensive fuzzy queries without selective indexes

### Week 6: Hardening, Demo, And Go/No-Go

Deliverables

- Integration tests across search + traversal + provenance
- Performance test script and baseline report
- Architecture review against long-term vision
- MVP demo narrative and release notes

Acceptance criteria

- End-to-end scenario passes:
  - search a term
  - inspect lineage
  - inspect edge evidence
- No critical data-integrity defects in tracked test set
- Stakeholder sign-off on MVP readiness and next-phase scope

Exit risks to watch

- Hidden migration debt from rapid iteration
- Missing observability around failed imports and query regressions

## Non-Functional Targets (MVP)

- Reliability: repeatable imports and idempotent writes
- Performance: P95 search less than 250 ms, P95 traversal less than 400 ms (depth 4)
- Integrity: all graph edges must reference a known source row
- Security: no raw SQL/Cypher outside repository layer
- Traceability: each edge includes source, method, confidence, and timestamps

## Test Strategy (By Level)

The current plan included testing implicitly (contract, integration, smoke, and end-to-end checks). This section makes it explicit.

## Test Stack Creation (Planned Output)

### Stack Decision (MVP Baseline)

- Test runner: Vitest (or Jest if framework constraints require it)
- HTTP/API testing: Supertest
- Integration environment: Testcontainers for PostgreSQL + AGE compatible container
- Fixtures and seeding: deterministic SQL/Prisma seed scripts per suite
- Performance baseline: k6 scripts for search and traversal endpoints
- CI: GitHub Actions matrix for fast tests and backend integration tests

### Repository Layout (Target)

- tests/unit
- tests/component
- tests/integration
- tests/functional
- tests/system
- tests/performance
- tests/fixtures

### Required Artifacts

- Testing guide in docs/testing.md
- CI workflow files for PR, nightly, and release gates
- Seed strategy doc for deterministic linguistic fixtures
- Shared test utilities for DB lifecycle, factories, and auth/context setup

### Acceptance Criteria For Test Stack Creation

- Running one command executes fast local tests (unit + component)
- Running one command executes integration tests against ephemeral DB services
- CI has separate jobs for fast tests and integration tests
- Failing integrity checks block merge on relevant PRs

### Unit Tests

Scope

- Pure logic in normalizer, validator, deduplicator, ranker, and confidence policies
- Repository query builders where deterministic input-output is possible

Execution

- Run on every pull request and every push to main
- Target runtime less than 2 minutes

Quality bar

- Critical domain modules (normalization, dedup, edge confidence) require high coverage
- New domain rules must ship with unit tests in same PR

### Component Tests

Scope

- Service layer behavior with repositories mocked or test doubles
- API handler behavior with in-memory HTTP app and mocked repositories

Execution

- Run on every pull request

Quality bar

- Error handling paths covered (invalid query, missing word, disputed edge)
- Response contracts verified for required fields

### Integration Tests

Scope

- Real PostgreSQL + AGE + Prisma against test database
- Repository methods and SQL/Cypher integration
- Import pipeline idempotency and provenance persistence

Execution

- Run on every pull request for changed backend code
- Full integration suite runs nightly

Quality bar

- No orphan edges
- Every etymology edge has at least one evidence source
- Re-running import does not duplicate words or edges

### Functional/API Tests

Scope

- Endpoint-level behavior from HTTP boundary through repositories
- Search and traversal workflows using seeded fixtures

Execution

- Run on every pull request

Quality bar

- Deterministic responses on fixed fixtures
- Relevance sanity checks for known inputs (father/Father/fader/fæder)

### System/End-to-End Tests

Scope

- Full stack scenario with docker-compose services
- User flow: search term -> fetch lineage -> inspect edge evidence

Execution

- Run before releases and at least daily on main

Quality bar

- Critical user journey must pass from cold start environment
- API latency and traversal depth limits remain within MVP targets

### Performance Tests

Scope

- Search latency, traversal latency, and import throughput on representative dataset

Execution

- Baseline in Week 6
- Re-run on schema/index/query changes

Quality bar

- Search P95 < 250 ms
- Traversal P95 < 400 ms at depth 4

### Data Integrity And Migration Tests

Scope

- Migration up/down safety on non-production snapshots
- Constraint and index behavior under realistic inserts
- Integrity checks for orphaned relations and invalid confidence ranges

Execution

- Run in CI on migration PRs
- Run full verification before each release candidate

Quality bar

- Migration succeeds from clean state and latest prior baseline
- No integrity check failures

## CI Gates (Minimum)

- Gate 1 (PR): unit + component + functional
- Gate 2 (PR backend changes): integration
- Gate 3 (main nightly): full integration + system smoke + data integrity checks
- Gate 4 (release): system end-to-end + performance baseline + migration verification

## Week Mapping For Tests

- Week 1: test harness bootstrap, fixture strategy, CI wiring
- Week 2: unit tests for normalization and relational constraints
- Week 3: integration tests for graph traversal and edge provenance
- Week 4: integration tests for import idempotency and rejection logging
- Week 5: functional/API tests for search and traversal contracts
- Week 6: system end-to-end tests and performance baseline report

## Team Rhythm

- Daily: 15-minute engineering sync with blocker tracking
- Twice weekly: architecture checkpoint against repository boundaries
- Weekly: stakeholder review with demo and risk register update

## Definition Of Done (MVP)

- Schema and migrations versioned and reproducible
- Import pipeline supports one real dataset adapter
- Search and graph endpoints documented and tested
- Provenance and confidence are present in all graph responses
- Demo script reproduces results from a clean environment

## Decision Gates

### Gate A (End of Week 2)
Continue only if relational uniqueness and source attribution are stable.

### Gate B (End of Week 4)
Continue only if import is idempotent and graph mapping is consistent.

### Gate C (End of Week 6)
Proceed to next phase only if performance and data integrity meet targets.

## Phase 2 Preview (After MVP)

- Add additional dataset adapters (Kaikki, Wiktionary, DBnary)
- Introduce user accounts and saved graph views
- Add AIService abstraction with strict provenance-aware prompting
- Evaluate pgvector for semantic exploration
- Consider external search engine only after measured need
