# LexGraph Web Application Development Plan

## Vision

Build **LexGraph** as an interactive **Graph Workspace** rather than a
collection of pages. The graph is the primary interface; search,
inspection, filtering, and navigation revolve around it.

------------------------------------------------------------------------

# Technology Stack

-   Next.js (App Router)
-   React + TypeScript
-   Tailwind CSS
-   shadcn/ui
-   TanStack Query
-   React Flow
-   Dagre (automatic layout)
-   PostgreSQL + Apache AGE (backend)
-   Vercel (frontend)

------------------------------------------------------------------------

# Frontend Architecture

    src/
      app/
      features/
        search/
        graph/
        inspector/
        timeline/
        filters/
        workspace/
      components/
      hooks/
      lib/
      services/
      types/

Organize code by **feature**, not page.

------------------------------------------------------------------------

# Core User Flow

    Home
      ↓
    Search
      ↓
    Workspace

No separate graph page.

The workspace contains:

-   Search bar
-   Interactive graph
-   Inspector panel
-   Breadcrumb
-   Graph controls
-   Filters

------------------------------------------------------------------------

# Workspace Layout

    +---------------------------------------------------------------+
    | Search                                                        |
    +---------------------------------------------------------------+
    |                                                               |
    |                 Interactive Graph                             |
    |                                                               |
    |---------------------------------------------------------------|
    | Inspector Panel                                               |
    | Word · Language · Meaning · Sources · Timeline                |
    +---------------------------------------------------------------+

------------------------------------------------------------------------

# Phased Development

## Week 1 --- Foundation

### Deliverables

-   Next.js project
-   Tailwind
-   shadcn/ui
-   TanStack Query
-   Global layout
-   Command-style search bar
-   Workspace page
-   API integration with search endpoint

### Acceptance

-   Typing shows suggestions
-   Selecting a word opens the workspace

------------------------------------------------------------------------

## Week 2 --- Inspector

### Deliverables

-   Inspector panel
-   Fetch word metadata
-   Breadcrumb showing language ancestry
-   Responsive layout

### Acceptance

Selecting any node updates the inspector without navigation.

------------------------------------------------------------------------

## Week 3 --- Graph

### Deliverables

-   React Flow integration
-   Dagre layout
-   Backend graph endpoint
-   Fit view
-   Zoom
-   Minimap
-   Node selection

### Acceptance

A complete ancestry graph renders cleanly.

------------------------------------------------------------------------

## Week 4 --- Interactivity

### Deliverables

-   Lazy expansion of descendants
-   Collapse branches
-   Filters
-   Loading states
-   Error states
-   Mobile support
-   Download PNG

### Acceptance

Workspace feels smooth and responsive.

------------------------------------------------------------------------

# Graph API

Use a flexible endpoint.

    POST /v1/graph/query

Example

``` json
{
  "rootWord":"father",
  "depth":8,
  "include":[
    "ancestors"
  ],
  "expand":false
}
```

Future include values:

-   descendants
-   cognates
-   borrowings
-   semanticChanges

------------------------------------------------------------------------

# Graph Controls

-   Zoom
-   Fit View
-   Reset
-   Collapse
-   Expand
-   Download PNG

------------------------------------------------------------------------

# Filters

-   Ancestors
-   Descendants
-   Borrowings
-   Cognates
-   Semantic Changes (future)

------------------------------------------------------------------------

# Timeline

Each node includes:

-   Approximate date
-   Historical period

Reserve space for a future interactive timeline.

------------------------------------------------------------------------

# Milestones

## MVP

-   Search
-   Workspace
-   Graph
-   Inspector

## Phase 2

-   Saved workspaces
-   Compare words
-   Search history
-   Export JSON/SVG

## Phase 3

-   Larger datasets
-   Better filtering
-   Public API
-   User accounts

------------------------------------------------------------------------

# Guiding Principles

-   Graph-first UX
-   Feature-based architecture
-   Backend owns graph traversal
-   Frontend focuses on rendering
-   Modular, scalable, production-ready
