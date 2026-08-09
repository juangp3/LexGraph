/*
  Warnings:

  - A unique constraint covering the columns `[edge_id,source_id,source_locator]` on the table `edge_sources` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[word_id,source_id,source_locator]` on the table `word_sources` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[language_id,text_normalized,lemma]` on the table `words` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "edge_sources" DROP CONSTRAINT "edge_sources_edge_id_fkey";

-- DropForeignKey
ALTER TABLE "edge_sources" DROP CONSTRAINT "edge_sources_source_id_fkey";

-- DropForeignKey
ALTER TABLE "etymology_edges" DROP CONSTRAINT "etymology_edges_from_word_id_fkey";

-- DropForeignKey
ALTER TABLE "etymology_edges" DROP CONSTRAINT "etymology_edges_to_word_id_fkey";

-- DropForeignKey
ALTER TABLE "language_families" DROP CONSTRAINT "language_families_parent_family_id_fkey";

-- DropForeignKey
ALTER TABLE "languages" DROP CONSTRAINT "languages_family_id_fkey";

-- DropForeignKey
ALTER TABLE "meanings" DROP CONSTRAINT "meanings_word_id_fkey";

-- DropForeignKey
ALTER TABLE "word_sources" DROP CONSTRAINT "word_sources_source_id_fkey";

-- DropForeignKey
ALTER TABLE "word_sources" DROP CONSTRAINT "word_sources_word_id_fkey";

-- DropForeignKey
ALTER TABLE "words" DROP CONSTRAINT "words_language_id_fkey";

-- DropIndex
DROP INDEX "idx_meanings_gloss_trgm";

-- DropIndex
DROP INDEX "idx_words_text_ascii_folded_trgm";

-- DropIndex
DROP INDEX "idx_words_text_normalized_trgm";

-- AlterTable
ALTER TABLE "edge_sources" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "etymology_edges" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "language_families" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "languages" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "meanings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sources" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "word_sources" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "words" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "source_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "rejection_log_path" TEXT,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "accepted_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "upserted_words" INTEGER NOT NULL DEFAULT 0,
    "upserted_edges" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_import_records" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "source_key" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_import_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_jobs_status_idx" ON "import_jobs"("status");

-- CreateIndex
CREATE INDEX "raw_import_records_job_id_idx" ON "raw_import_records"("job_id");

-- CreateIndex
CREATE INDEX "raw_import_records_source_hash_idx" ON "raw_import_records"("source_hash");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "uq_edge_sources_edge_source_locator" ON "edge_sources"("edge_id", "source_id", COALESCE("source_locator", ''));

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "uq_word_sources_prisma_compat" ON "word_sources"("word_id", "source_id", COALESCE("source_locator", ''));

-- CreateIndex
CREATE UNIQUE INDEX "uq_words_prisma_compat" ON "words"("language_id", "text_normalized", "lemma");

-- AddForeignKey
ALTER TABLE "language_families" ADD CONSTRAINT "language_families_parent_family_id_fkey" FOREIGN KEY ("parent_family_id") REFERENCES "language_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "languages" ADD CONSTRAINT "languages_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "language_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_import_records" ADD CONSTRAINT "raw_import_records_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "words" ADD CONSTRAINT "words_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meanings" ADD CONSTRAINT "meanings_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_sources" ADD CONSTRAINT "word_sources_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_sources" ADD CONSTRAINT "word_sources_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etymology_edges" ADD CONSTRAINT "etymology_edges_from_word_id_fkey" FOREIGN KEY ("from_word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etymology_edges" ADD CONSTRAINT "etymology_edges_to_word_id_fkey" FOREIGN KEY ("to_word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edge_sources" ADD CONSTRAINT "edge_sources_edge_id_fkey" FOREIGN KEY ("edge_id") REFERENCES "etymology_edges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edge_sources" ADD CONSTRAINT "edge_sources_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_edge_sources_source_id" RENAME TO "edge_sources_source_id_idx";

-- RenameIndex
ALTER INDEX "idx_etymology_edges_to_type" RENAME TO "etymology_edges_to_word_id_relation_type_idx";

-- RenameIndex
ALTER INDEX "idx_etymology_edges_type" RENAME TO "etymology_edges_relation_type_idx";

-- RenameIndex
ALTER INDEX "idx_language_families_parent_family_id" RENAME TO "language_families_parent_family_id_idx";

-- RenameIndex
ALTER INDEX "idx_languages_family_id" RENAME TO "languages_family_id_idx";

-- RenameIndex
ALTER INDEX "idx_languages_iso639_3" RENAME TO "languages_iso639_3_idx";

-- RenameIndex
ALTER INDEX "idx_meanings_word_id" RENAME TO "meanings_word_id_idx";

-- RenameIndex
ALTER INDEX "idx_sources_year" RENAME TO "sources_year_idx";

-- RenameIndex
ALTER INDEX "idx_word_sources_source_id" RENAME TO "word_sources_source_id_idx";

-- RenameIndex
ALTER INDEX "idx_words_is_reconstructed" RENAME TO "words_is_reconstructed_idx";

-- RenameIndex
ALTER INDEX "idx_words_language_id" RENAME TO "words_language_id_idx";
