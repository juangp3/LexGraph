# LexGraph Optimization Plan

## Purpose

This document refines the current roadmap based on an architectural
review. The goal is **not** to rewrite the existing work, but to
strengthen the foundation while preserving the current direction.

------------------------------------------------------------------------

# Executive Priorities

## Priority 1 --- Shift to a Graph Workspace

The graph should become the primary product.

Current:

Search → Word → Graph

Target:

Search → Workspace

The workspace contains:

-   Search
-   Interactive graph
-   Inspector
-   Breadcrumbs
-   Graph controls
-   Filters
-   Timeline placeholder

Users remain in the workspace instead of navigating between pages.

------------------------------------------------------------------------

## Priority 2 --- Frontend Becomes the Focus

The backend architecture is already strong.

Development emphasis should move toward:

-   usability
-   visual hierarchy
-   interaction quality
-   responsiveness
-   accessibility
-   exploration

Avoid adding backend complexity until the UX demonstrates the product
vision.

------------------------------------------------------------------------

## Priority 3 --- Introduce a Graph Domain

Create a dedicated graph feature with clear layers.

    features/
      graph/
        domain/
        application/
        infrastructure/
        presentation/

Responsibilities include:

-   traversal
-   filtering
-   expansion
-   layout orchestration
-   serialization
-   export

------------------------------------------------------------------------

# API Evolution

Replace endpoint-specific graph APIs with a flexible query endpoint.

    POST /v1/graph/query

Example:

``` json
{
  "rootWord":"father",
  "depth":8,
  "include":["ancestors"],
  "expand":false
}
```

Future include options:

-   descendants
-   borrowings
-   cognates
-   semanticChanges
-   relatedConcepts

------------------------------------------------------------------------

# Graph Response Standard

Always return:

``` json
{
  "graph":{
    "nodes":[],
    "edges":[]
  },
  "metadata":{},
  "viewport":{},
  "statistics":{}
}
```

This enables layout hints, analytics, exports, and caching.

------------------------------------------------------------------------

# Graph Model Evolution

Current:

Word → Word

Future:

Word → EvolutionEvent → Word

EvolutionEvent stores:

-   date
-   linguistic process
-   confidence
-   notes
-   references

This enables richer historical explanations without overloading edge
metadata.

------------------------------------------------------------------------

# Workspace Components

-   Search
-   Graph canvas
-   Inspector
-   Breadcrumb
-   Timeline placeholder
-   Graph controls
-   Filters
-   Status bar

------------------------------------------------------------------------

# Initial Graph Controls

-   Zoom
-   Fit View
-   Reset
-   Expand
-   Collapse
-   Download PNG
-   Export JSON

------------------------------------------------------------------------

# Filters

Design now even if partially implemented.

-   Ancestors
-   Descendants
-   Borrowings
-   Cognates
-   Semantic changes
-   Language family

------------------------------------------------------------------------

# Inspector

Selecting a node updates the inspector without route changes.

Display:

-   word
-   language
-   family
-   meaning
-   pronunciation
-   period
-   references
-   outgoing relationships

------------------------------------------------------------------------

# Timeline Readiness

Each node should expose:

-   earliest attestation
-   latest attestation
-   historical period

Reserve UI space for future timeline interaction.

------------------------------------------------------------------------

# Product Vision

Treat LexGraph as a Linguistic Knowledge Graph.

Primary entities:

-   Word
-   Language
-   Language Family
-   Meaning
-   Historical Period
-   Writing System
-   Source
-   Region
-   Evolution Event

Everything is connected through relationships.

------------------------------------------------------------------------

# Development Roadmap

## Phase A

-   Workspace
-   Inspector
-   React Flow
-   Search integration

## Phase B

-   Lazy expansion
-   Filters
-   Export
-   Saved workspaces

## Phase C

-   Compare multiple words
-   Public API
-   Larger datasets

------------------------------------------------------------------------

# Success Metrics

## Technical

-   Feature-based architecture maintained
-   No business logic in UI
-   Single graph query endpoint
-   Stable graph response schema

## UX

-   Reach graph within two interactions
-   Inspector updates instantly
-   Responsive graph interactions
-   Minimal layout shifts

------------------------------------------------------------------------

# Risks

-   Over-investing in backend before validating UX
-   Too many specialized endpoints
-   Mixing graph logic into presentation
-   Turning the workspace into page navigation

------------------------------------------------------------------------

# Guiding Principles

1.  Graph-first experience.
2.  Workspace over pages.
3.  Backend owns traversal.
4.  Frontend owns interaction.
5.  Modular and extensible architecture.
6.  Optimize for exploration and learning.

# Implementation Checklist

- [x] **Phase A: Workspace Scaffolding**
  - [x] Create `/workspace` route and layout.
  - [x] Create placeholder components for all workspace elements.
  - [x] Assemble workspace UI with a grid layout.
  - [x] Implement `WorkspaceSearch` component.
  - [x] Implement `WorkspaceBreadcrumb` component.
  - [x] Implement `WorkspaceGraphControls` component.
  - [x] Implement `WorkspaceFilters` component.
  - [x] Implement `WorkspaceStatusBar` component.
  - [x] Implement `WorkspaceTimeline` component.
- [x] **API Evolution**
  - [x] Create `POST /v1/graph/query` endpoint.
  - [x] Implement graph query service logic.
  - [x] Adapt `pg-graph.repository.ts` for flexible queries.
- [ ] **Graph Response Standard**
  - [ ] Ensure all graph endpoints return the standard response shape.
- [x] **Frontend Integration**
  - [x] Update `GraphCanvas` to use the new query endpoint.
  - [x] Wire up `WorkspaceGraphControls` to the React Flow instance.
  - [x] Wire up `WorkspaceFilters` to the graph query.
