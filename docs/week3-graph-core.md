# Week 3 Graph Core

## Scope Delivered

- Graph provenance schema in relational DB:
  - etymology_edges
  - edge_sources
- Graph repository traversal methods:
  - findAncestors
  - findDescendants
  - findBorrowings
  - findCognates
- Cycle-safe traversal via recursive CTE path guards.
- Ordered traversal outputs with source references and confidence metadata.

## AGE Initialization

- Script: scripts/db/age-week3-conventions.sql
- Graph name: lexgraph
- Label conventions:
  - Nodes: Word, Language, LanguageFamily, Source
  - Edges: EVOLVED_FROM, BORROWED_FROM, COGNATE_WITH

## Traversal Payload Contract

Each traversal edge includes:

- edgeId
- fromWordId
- toWordId
- relationType
- confidence
- method
- isDisputed
- evidenceSummary
- depth
- path
- sources[] with sourceId, sourceLocator, quoteExcerpt, confidenceDelta

## Notes

Week 3 uses relational traversal for deterministic and testable behavior while maintaining AGE conventions for projection compatibility.
