-- Restore uuid defaults for primary id columns dropped in 20260806211713_phase4_import_jobs

ALTER TABLE "edge_sources" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "etymology_edges" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "language_families" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "languages" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "meanings" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "sources" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "word_sources" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();
ALTER TABLE "words" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4();

-- Note: import_jobs and raw_import_records intentionally do not have defaults; import process sets those IDs explicitly.
