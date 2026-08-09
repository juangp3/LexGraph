# Spec 02: Unified Graph Depth Constraints Across Frontend and Backend

## Goal
Define and enforce one shared depth policy for graph traversal and workspace preferences to prevent UI/API drift.

## Problem Statement
Frontend settings currently clamp depth to 1-8 while backend allows up to 10 in preference updates and graph creation paths. This mismatch confuses users and complicates tests.

## Scope
In scope:
- Standardize min/max/default depth in one canonical location.
- Apply policy to settings UI, GraphCanvas usage, backend validation, and saved graph creation.
- Update tests and docs to reflect the canonical range.

Out of scope:
- Changing traversal algorithm complexity itself.

## Decision
Recommended canonical range:
- `MIN_GRAPH_DEPTH = 1`
- `MAX_GRAPH_DEPTH = 8`
- `DEFAULT_GRAPH_DEPTH = 3` for saved graph defaults

Rationale:
- Keeps graph workloads bounded.
- Matches current user-facing UI and expected responsiveness.

## Proposed Design

### 1. Backend source of truth
Create backend constants file, e.g. `src/domain/graph-depth.ts`:
- Export min/max/default constants.
- Use in:
  - workspace preference patch validation
  - saved graph creation validation
  - any graph route depth parsing where possible

### 2. Frontend alignment
Create frontend constants, e.g. `web/src/features/graph/constants.ts`:
- Mirror range values from backend docs.
- Use in:
  - workspace settings input attributes and clamping
  - GraphCanvas depth normalization
  - saved graph payload depth

### 3. Contract documentation
Update API and user docs:
- Depth accepted range
- Behavior for out-of-range values (clamp vs reject)

### 4. Validation behavior
Preferred behavior:
- API: reject invalid values with clear error code/message.
- UI: clamp input and prevent invalid submissions.

## Implementation Tasks
1. Add constants files.
2. Replace inline numeric literals in frontend/backend.
3. Add backend validation tests for boundaries (0, 1, 8, 9, 10).
4. Update frontend tests for settings and graph usage.

## Test Plan
Backend:
- Unit tests for orchestrator and route validation boundary cases.
Frontend:
- Settings page tests for clamping and disabled save state.
- GraphCanvas tests confirming selected depth usage.

## Acceptance Criteria
- Same depth range enforced in UI and API.
- No hardcoded depth literals remain in graph preference paths.
- Boundary tests pass in both frontend and backend.

## Risks and Mitigations
- Risk: hidden code paths still use legacy limits.
- Mitigation: run literal search for depth bounds and add checklist in PR template.

## Rollout
- Ship with migration-free code change.
- Communicate in changelog that depth policy is now strict and consistent.
