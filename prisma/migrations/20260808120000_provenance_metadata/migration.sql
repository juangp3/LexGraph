-- AlterTable
ALTER TABLE "word_sources"
  ADD COLUMN "evidence_summary" TEXT,
  ADD COLUMN "conflict_type" TEXT,
  ADD COLUMN "conflict_details" TEXT;

ALTER TABLE "etymology_edges"
  ADD COLUMN "conflict_type" TEXT,
  ADD COLUMN "conflict_details" TEXT;
