# Item 9 Minimum Gate

This gate is the required baseline before continuing large user-facing feature expansion.

## Goal

Allow feature delivery to continue while preventing blind performance and reliability regressions.

## Required criteria

1. Query and request timeouts are enforced.
2. Graph budgets are enforced (depth, nodes, edges) with truncation metadata.
3. Endpoint protection exists (rate limits and expensive-operation concurrency guard).
4. Percentile metrics and regression checks are active in CI.
5. Backup and restore drill are automated.
6. Health/readiness checks and deploy smoke verification are enforced.

## Repository evidence

1. Timeouts and endpoint safeguards:
   - `src/app.ts`
   - `src/db/client.ts`
2. Graph budgets and truncation:
   - `src/services/graph.service.ts`
3. Metrics and percentile snapshots:
   - `src/observability/metrics.ts`
   - `src/app.ts` (`/v1/metrics`)
4. Regression checks and benchmark baselines:
   - `.github/workflows/ci.yml`
   - `scripts/perf/run-api-bench.ts`
   - `scripts/perf/run-ci-perf.ts`
   - `tests/performance/baseline-api.json`
5. Backup and restore drill:
   - `scripts/db/backup.ts`
   - `scripts/db/restore.ts`
   - `scripts/db/restore-drill.ts`
6. Scheduled quality/perf execution:
   - `.github/workflows/nightly.yml`

## Execution commands

- Build and test safety:
  - `npm run build`
  - `npm run test:functional`
- Performance checks:
  - `npm run perf:api`
  - `npm run perf:ci`
  - `npm run perf:graph`
- Data safety:
  - `npm run db:backup`
  - `npm run db:restore:drill`

## Decision rule

Feature work may proceed when all required criteria above are passing and the listed commands are green in CI/nightly.

## Current status

- Item 9 minimum gate: **READY**
- Verified evidence:
  - `npm run build` completed successfully
  - `npm run test:functional` completed successfully with 38 passing tests
  - `npm run perf:ci` completed successfully after aligning the perf wrapper with the benchmark payload
  - Live health check returned `{"ok":true,"service":"lexgraph-api","version":"0.1.0","datasetVersion":"2026-08"}`
- Remaining full-Phase-9 advanced work (non-blocking for feature delivery):
  - full distributed tracing backend integration
  - dashboard provisioning as code in monitoring platform
  - production alert routing integration

## Recommended next implementation slice

With the minimum gate now verified, the next priority should be a provenance-and-trust expansion that builds directly on the current baseline:

1. Richer claim/evidence modeling
   - add first-class claim, evidence, and source-version entities beyond the current import-job path
   - expose confidence, disputed state, and source summaries in graph/search responses
2. Staged import validation and rollback safety
   - introduce staging/validation flow for imports before promotion into the primary graph dataset
   - preserve replayability and partial-failure recovery metadata
3. Data-quality reporting
   - add conflict, orphan, and missing-source reporting to the import status experience
   - surface these in an admin/data-quality view
4. Search benchmark expansion
   - grow the benchmark corpus beyond the initial exact/case/accent cases
   - add language-specific and historical-form coverage along with ranking regression checks
5. Performance gate hardening
   - keep the perf wrapper and benchmark scripts stable across local and CI execution
   - preserve baseline comparison as part of the release gate

This sequence keeps the product moving while closing the highest-value trust, auditability, and quality gaps that remain after the minimum gate.
