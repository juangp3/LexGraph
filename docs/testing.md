# LexGraph Testing Guide (Week 1)

## Test Commands

- `npm run test:unit`
- `npm run test:component`
- `npm run test:functional`
- `npm run test:integration`
- `npm run test:system`
- `npm run test:fast`
- `npm run test:all`

## Infrastructure Commands

- `npm run infra:doctor`
- `npm run infra:up`
- `npm run infra:down`
- `npm run infra:full`

If Docker shows a named-pipe error on Windows, run `docker context use default` and retry.

## Week 2 Database Commands

- `npm run db:migrate`
- `npm run db:seed:week2`

## Week 4 Import Commands

- `npm run import:week4`

## Scope By Suite

- Unit: pure domain logic
- Component: services with mocked repositories
- Functional: API contract checks
- Integration: real infrastructure wiring (expanded in Week 2)
- System: smoke flow across app boundaries
- Performance: k6 smoke script under tests/performance

## Human-In-The-Loop Validation (Current)

1. Run `npm install`.
2. Start services: `npm run infra:up`.
3. Apply schema: `npm run db:migrate`.
4. Seed deterministic fixture: `npm run db:seed:week2`.
5. Run `npm run test:fast`.
6. Run `npm run import:week4`.
7. Run integration tests:
   - PowerShell: `$env:RUN_INTEGRATION='true'; npm run test:integration; Remove-Item Env:RUN_INTEGRATION`
   - Bash: `RUN_INTEGRATION=true npm run test:integration`
8. Run app: `npm run dev`.
9. Validate endpoints:
   - `GET /health`
   - `GET /v1/search?q=father`
   - `GET /v1/search?q=fader&limit=10`
   - `GET /v1/search?q=father&language=English`
   - `GET /v1/graph/ancestors/{wordId}?depth=4`
   - `GET /v1/graph/descendants/{wordId}?depth=4`
10. Run `npm run test:system`.

## CI Behavior

- Pull requests run unit, component, and functional tests.
- Pull requests also run integration tests when backend code changes.
- Nightly and release-grade gates are configured in the workflow baseline and will tighten in Week 2-6.
