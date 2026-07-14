# Seed Strategy (Week 2)

## Goal

Provide deterministic relational records that validate:

- canonical word uniqueness in a language context
- source attribution through word_sources
- one reproducible lineage-oriented dataset for HIL and CI

## Source Fixture

- tests/fixtures/week2-lineage.json

## Seed Execution

- Command: `npm run db:seed:week2`
- Script: scripts/seed-week2.ts

## Guarantees

- Uses stable fixture input committed in repository.
- Upserts language family and languages by stable keys.
- Prevents duplicate inserts by conflict checks or existing-record lookup.
- Attaches a source record to each seeded word via word_sources.

## Current Lineage-Oriented Records

- Modern English: father
- Old English: faeder
- Proto stage: *fader

These records are intentionally minimal to support Week 2 relational acceptance criteria.
