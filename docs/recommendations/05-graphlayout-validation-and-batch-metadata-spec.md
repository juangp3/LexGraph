# Spec 05: Graph Layout Enum Validation and Batched Metadata API

## Goal
Strengthen contract integrity by validating `graphLayout` server-side and improve graph performance by replacing per-node metadata fetches with batched retrieval.

## Problem Statement
- `graphLayout` is currently trimmed but not validated against supported enum values.
- Graph UI loads node metadata via many individual requests (N+1 pattern), increasing latency for larger graphs.

## Scope
In scope:
- Enforce allowed graph layout values in backend preferences and saved graph creation.
- Add batch metadata endpoint for graph node details.
- Refactor frontend graph service to use batched metadata call.

Out of scope:
- Large schema redesign.

## Part A: Enum Validation

### Allowed values
- `hierarchical`
- `radial`
- `grid`
- `force-directed` (if product-approved)

### Backend behavior
- On invalid `graphLayout`, return 400 with error code `INVALID_GRAPH_LAYOUT`.
- Apply in:
  - preferences patch path
  - saved graph creation path

## Part B: Batched Metadata Endpoint

### New endpoint
- `POST /v1/words/batch`
- Request body:
  - `wordIds: string[]`
- Response:
  - `items: Array<{ id, textOriginal, language, stage, ... }>`

### Constraints
- Max ids per request (e.g. 500).
- Deduplicate incoming ids.
- Preserve input ordering in response when practical.

### Frontend change
- Replace repeated `/v1/words/:id` calls with single batch call per graph load.
- Keep fallback behavior for partial misses.

## Data Layer Considerations
- Add repository method for bulk word fetch by ids.
- Use parameterized `WHERE id = ANY($1)` query.
- Ensure index usage on `words.id` (already expected with PK).

## Implementation Tasks
1. Add enum validator utility and integrate into orchestrator.
2. Add batch route/controller/repository method.
3. Update frontend `graph.service.ts` metadata hydration path.
4. Add tests for invalid layout and batch endpoint behavior.

## Test Plan
Backend:
- Invalid layout strings rejected.
- Batch endpoint validates UUID list and limits.
- Partial hit behavior tested.
Frontend:
- Graph load executes one metadata request per graph load.
- UI still handles missing metadata gracefully.

## Acceptance Criteria
- Invalid layout values cannot be persisted.
- Graph metadata loading no longer issues one request per node.
- Measurable latency improvement on medium/large graphs.

## Risks and Mitigations
- Risk: larger payload size on batch route.
- Mitigation: cap request size and paginate if necessary.
- Risk: new endpoint increases backend complexity.
- Mitigation: keep API minimal and typed.

## Rollout
- Release enum validation first (low risk).
- Then release batch endpoint + frontend switch.
- Monitor graph load times and error rates after deployment.
