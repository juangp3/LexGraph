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

## Scope By Suite

- Unit: pure domain logic
- Component: services with mocked repositories
- Functional: API contract checks
- Integration: real infrastructure wiring (expanded in Week 2)
- System: smoke flow across app boundaries
- Performance: k6 smoke script under tests/performance

## Human-In-The-Loop Validation (Current)

1. Run `npm install`.
2. Run `npm run test:fast`.
3. Start services: `docker compose up -d postgres apache-age redis`.
4. Run app: `npm run dev`.
5. Validate endpoints:
   - `GET /health`
   - `GET /v1/search?q=father`
6. Optionally run `npm run test:system`.

## CI Behavior

- Pull requests run unit, component, and functional tests.
- Pull requests also run integration tests when backend code changes.
- Nightly and release-grade gates are configured in the workflow baseline and will tighten in Week 2-6.
