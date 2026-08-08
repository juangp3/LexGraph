# Capacity

## Current assumptions

- API process: Node.js, stateless request handling.
- Primary state: PostgreSQL.
- In-process cache: best-effort and non-authoritative.

## Throughput validation

Use these runs to maintain a capacity history:

1. `npm run perf:api`
2. `npm run test:performance`
3. `npm run perf:graph`

Persist benchmark outputs as dated artifacts in CI.

## Growth model (initial)

- Year 1: up to 1M entities
- Year 2: up to 5M entities
- Year 3: up to 20M entities

## Scaling triggers

Scale API instances when any of the following is sustained:

- CPU > 70%
- Memory > 75%
- API p95 > target with stable DB health

Scale database strategy when sustained:

- DB CPU > 80%
- connections > 80% of pool budget
- query p95 regresses despite query/index optimization

## Dataset profile for performance

Use representative datasets that include:

- multiple language families
- realistic etymology depth
- cognate and borrowing links
- mixed dense and sparse graph regions

`tests/fixtures/seed-v2.json` is the minimum baseline, not production-like maximum.

## Cost per request

Track over fixed windows:

- infra monthly cost / successful API requests
- infra monthly cost / graph requests
- infra monthly cost / search requests

Runtime estimate is available in `GET /v1/metrics` under `cost` when `ESTIMATED_INFRA_COST_USD_PER_HOUR` is configured.

## SLOs

Initial internal SLOs:

- 99.5% successful API requests per 30-day window
- 95% of `GET /v1/search` under 400 ms
- 95% of `GET /v1/words/:wordId` under 250 ms
- 95% of `GET /v1/graph/:entityId/expand?depth=2` under 1000 ms

## Error budget

At 99.5% SLO, monthly error budget is 0.5% unsuccessful requests.

Policy:

- If error budget burn exceeds 50% in first half of window, prioritize reliability work.
- If burn exceeds 100%, freeze non-critical performance feature rollout until stabilized.

## Readiness checklist

- pool bounds configured
- query timeouts configured
- graph budgets enforced
- perf CI gate enabled
- nightly perf workflow enabled
