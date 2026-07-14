# Week 6 Hardening, Demo, and Go/No-Go

## Delivered

- Added missing word details API contract endpoint:
  - `GET /v1/words/:wordId`
- Added repository-backed detail payload with:
  - normalized form
  - language and stage metadata
  - meanings
  - source attribution with confidence values
- Added integrity gate script:
  - `npm run integrity:check`
- Added performance smoke coverage:
  - `tests/performance/search-smoke.js`
  - `tests/performance/traversal-smoke.js`
- CI/nightly quality gates now execute data integrity checks.

## Go/No-Go Checks

1. `npm run build`
2. `npm run test:fast`
3. `RUN_INTEGRATION=true npm run test:integration`
4. `npm run test:system`
5. `npm run integrity:check`
6. Optional: `npm run test:performance:search`
7. Optional: `WORD_ID=<fixture-word-id> npm run test:performance:traversal`

## Demo Narrative

1. Search a known term (`father`) and verify ranked candidates.
2. Open a selected word detail (`/v1/words/:wordId`) and inspect normalized text plus source confidence.
3. Traverse ancestry (`/v1/graph/ancestors/:wordId?depth=4`).
4. Validate edge evidence appears in graph response payload.

## Notes

- Traversal smoke accepts 200 or 404 to remain stable across fixture availability.
- Integrity checks are strict: any edge without evidence fails the gate.
