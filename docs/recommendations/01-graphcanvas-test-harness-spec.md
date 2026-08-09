# Spec 01: GraphCanvas Test Harness and Stability

## Goal
Restore reliable frontend graph tests by introducing a consistent test harness for authenticated components and updating assertions to match the new preference-driven graph behavior.

## Problem Statement
GraphCanvas now depends on auth context (`useAuthSession`) and preference queries. Existing tests render GraphCanvas without `AuthSessionProvider`, causing runtime failures. Some test expectations also use stale fixed-depth assumptions.

## Scope
In scope:
- Add a reusable test wrapper for GraphCanvas and related workspace components.
- Provide a deterministic auth session test double.
- Update graph context/url tests to preference-driven depth expectations.
- Add a small helper for default query-client setup in frontend tests.

Out of scope:
- Changing production auth behavior.
- Rewriting all frontend tests in one pass.

## Current Failure Pattern
- Error: `useAuthSession must be used within AuthSessionProvider`.
- Failing suite: `web/tests/graph/graph.canvas.context-url.test.tsx`.

## Proposed Design

### 1. Create shared test providers
Create `web/tests/helpers/renderWithAppProviders.tsx`:
- Wraps component with:
  - `AuthSessionProvider` substitute (mock provider or context override)
  - `QueryClientProvider` with retries disabled
  - Optional theme provider if required by component tree
- Expose utilities:
  - `renderWithProviders(ui, options)`
  - `createTestQueryClient()`

### 2. Auth test session contract
Add deterministic session defaults:
- authenticated: true
- token: `test-token`
- user object with minimal valid fields
- override hooks for unauthenticated scenarios

### 3. Update graph tests
Refactor `web/tests/graph/graph.canvas.context-url.test.tsx`:
- Use `renderWithProviders`.
- Mock preference query result with depth/layout values.
- Replace fixed assertions tied to depth `3` with preference-derived values.

### 4. Add regression coverage
Add/adjust tests for:
- GraphCanvas mount with authenticated provider.
- GraphCanvas mount unauthenticated still renders safe state.
- URL restore behavior with preference depth applied to descendant expansion.

## Implementation Tasks
1. Add helper in `web/tests/helpers/`.
2. Update GraphCanvas tests to use helper.
3. Update mocks for graph service calls to include new args where needed.
4. Run targeted frontend tests.

## Test Plan
- Command:
  - `npm run test -- tests/graph/graph.canvas.context-url.test.tsx`
- Expected:
  - All tests pass.
  - No provider/context runtime errors.

## Acceptance Criteria
- GraphCanvas tests pass consistently in local and CI.
- No direct component tests call `useAuthSession` without provider.
- Depth assertions are aligned with current preference-driven behavior.

## Risks and Mitigations
- Risk: over-mocking hides integration issues.
- Mitigation: keep one light integration test using real providers and mocked network only.

## Rollout
- Deliver as a standalone test-infra commit.
- Enforce usage via test lint rule or team convention in testing docs.
