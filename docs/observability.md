# Observability

## Current instrumentation

`src/observability/metrics.ts` tracks:

- HTTP: request count, error count, p50/p95/p99 latency
- Search: request count, zero-result rate, p50/p95/p99 latency
- Graph: request count, truncation count, depth, nodes, edges, p50/p95/p99 latency
- Database: query count, error count, slow query count, p50/p95/p99 latency
- Cache: request count, hit/miss, hit ratio, p50/p95/p99 lookup latency

Endpoint:

- `GET /v1/metrics`

## Structured logs

Per-request structured logs include:

- `requestId`
- `traceId`
- `method`
- `path`
- `statusCode`
- `durationMs`

## Correlation

Request identity headers:

- `X-Request-ID`
- `X-Trace-ID`

## Alert seeds

Suggested initial alert thresholds:

- API p95 > 1000 ms for 5 min (warning)
- API p95 > 5000 ms for 5 min (critical)
- API error rate > 5% for 5 min (critical)
- DB slow query count trend increasing for 15 min (warning)
- Graph truncation rate sudden increase (warning)

## Dashboards (minimum)

- API RED: rate, errors, duration by route
- Search: p95 latency, zero-result ratio
- Graph: p95 latency, avg depth, truncation ratio
- Database: query p95, slow query count, error count
- Cache: hit ratio, request volume

## Tracing

`traceId` generation and propagation is active at request boundary. Full OpenTelemetry exporter integration is a pending enhancement when backend telemetry sink is selected.
