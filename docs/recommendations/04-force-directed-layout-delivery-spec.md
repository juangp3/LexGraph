# Spec 04: Force-Directed Layout Delivery or Safe Deferment

## Goal
Resolve mismatch between UI option and runtime behavior by either delivering a real force-directed layout or clearly deferring it.

## Problem Statement
Settings expose `Force-directed`, but implementation currently falls back to radial. This creates trust and usability issues.

## Scope
Option A (preferred):
- Implement real force-directed layout.
Option B (fallback):
- Hide or mark force-directed as experimental until implemented.

Out of scope:
- Full GPU/WebGL layout engine.

## Option A: Implement Real Force-Directed

### Technical Approach
- Use a deterministic force simulation (e.g. d3-force) in graph service or client layer.
- Inputs:
  - nodes with initial positions
  - edges with spring constraints
- Forces:
  - link force (edge distance)
  - charge force (repulsion)
  - center force
  - optional collision force by node radius

### Determinism
- Seed initial positions from stable hash (node id) for repeatable layouts.
- Fixed iteration count per node-size bucket.

### Performance Controls
- Max nodes for force layout path (e.g. 500).
- Fallback to hierarchical when above cap with user notice.

### UX
- Show `Computing layout...` status for larger graphs.
- Keep current viewport and fit view behavior predictable.

## Option B: Safe Deferment
- Remove `force-directed` from selectable options in settings.
- Keep backend acceptance for forward compatibility if desired.
- Add docs note: planned layout.

## Implementation Tasks
Option A:
1. Add force simulation module.
2. Integrate in `applyLayout` switch branch.
3. Add unit tests for deterministic output shape.
4. Add performance benchmark with medium/large synthetic graphs.

Option B:
1. Remove/disable option in settings UI.
2. Normalize legacy saved preferences to supported options.

## Test Plan
- Verify visible distinction among hierarchical/radial/grid/force.
- Confirm stable behavior across refreshes for same graph.
- Measure render/layout time for representative graph sizes.

## Acceptance Criteria
Option A:
- Force-directed produces non-radial, non-hierarchical placement.
- Meets performance budget on target hardware.
Option B:
- No force-directed option visible to end users.
- No misleading behavior remains.

## Risks and Mitigations
- Risk: simulation cost and layout jitter.
- Mitigation: deterministic seeding, iteration caps, and node thresholds.

## Rollout
- Start with feature flag on Option A.
- If quality/perf fails targets, switch to Option B immediately.
