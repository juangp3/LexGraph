-- Apache AGE bootstrap script.
-- This script is intended to run against the AGE-enabled PostgreSQL service.

CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

SELECT create_graph('lexgraph')
WHERE NOT EXISTS (
  SELECT 1
  FROM ag_catalog.ag_graph
  WHERE name = 'lexgraph'
);
