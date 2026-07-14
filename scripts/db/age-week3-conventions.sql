-- Week 3 AGE graph conventions bootstrap.
-- Run this against the AGE-enabled PostgreSQL service.

CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

SELECT create_graph('lexgraph')
WHERE NOT EXISTS (
  SELECT 1 FROM ag_catalog.ag_graph WHERE name = 'lexgraph'
);

-- Placeholder schema conventions for labels used in traversal projections.
-- Node labels: Word, Language, LanguageFamily, Source
-- Edge labels: EVOLVED_FROM, BORROWED_FROM, COGNATE_WITH
