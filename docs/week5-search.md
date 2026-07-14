# Week 5 Search Wiring

## Implemented

- PostgreSQL-backed search repository:
  - src/repositories/pg-search.repository.ts
- Search endpoint wiring in app:
  - GET /v1/search
- Query normalization:
  - Unicode normalization
  - accent folding via unaccent
  - lowercase matching
- Fuzzy matching and ranking:
  - pg_trgm similarity and exact-match boost
- Optional language filter and limit support

## API Contract

GET /v1/search?q=<query>&language=<optional>&limit=<optional>

Response fields:

- query
- language
- total
- results[] containing:
  - wordId
  - textOriginal
  - textNormalized
  - language
  - stage
  - score

## Tests

- Functional API tests for search contract and missing-query validation.
- Integration tests for:
  - exact-match ranking
  - fuzzy variant retrieval
  - language filter behavior
