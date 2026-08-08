# Performance

## Scope

This document defines measurable performance gates for API, graph traversal, and frontend graph rendering.

## Baseline commands

- API benchmark: `npm run perf:api`
- API regression gate: `npm run perf:ci`
- Graph rendering benchmark: `npm run perf:graph`
- k6 smoke tests:
  - `npm run test:performance:search`
  - `npm run test:performance:word`
  - `npm run test:performance:traversal`

## Latency targets

| Operation | p95 target |
| --- | ---: |
| `GET /health` | < 50 ms |
| `GET /v1/search` | < 400 ms |
| `GET /v1/words/:wordId` | < 250 ms |
| `GET /v1/graph/:entityId/expand?depth=2` | < 1000 ms |
| `GET /v1/graph/:entityId/expand?depth=3` | < 2000 ms |

## Regression policy

- Baseline file: `tests/performance/baseline-api.json`
- CI threshold: `MAX_REGRESSION_PCT` (default 15-20%)
- Fail build when endpoint p95 exceeds allowed regression threshold.

## Graph traversal budgets

Configured by environment variables:

- `GRAPH_MAX_DEPTH` (default `4`)
- `GRAPH_MAX_NODES` (default `500`)
- `GRAPH_MAX_EDGES` (default `1000`)
- `GRAPH_QUERY_TIMEOUT_MS` (default `4000`)

Responses include truncation metadata when budget constraints are applied.

## API timeouts and pool limits

- `API_QUERY_TIMEOUT_MS` default `2000`
- `DB_QUERY_TIMEOUT_MS` default `2000`
- `DB_STATEMENT_TIMEOUT_MS` default `5000`
- `DB_POOL_MAX` default `20`
- `DB_POOL_MIN` default `2`

## Notes

- Performance metrics are exposed at `GET /v1/metrics`.
- Percentile tracking is enabled for HTTP, search, graph, database, and cache lookup paths.
