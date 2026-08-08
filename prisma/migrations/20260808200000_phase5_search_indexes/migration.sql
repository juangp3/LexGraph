-- Phase 5: Search & Discovery Engine — restore and extend search indexes

-- Ensure pg_trgm and unaccent extensions exist
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Restore GIN trigram indexes on words (dropped in phase4 Prisma migration)
CREATE INDEX IF NOT EXISTS idx_words_text_normalized_trgm
  ON words USING gin(text_normalized gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_words_text_ascii_folded_trgm
  ON words USING gin(text_ascii_folded gin_trgm_ops);

-- GIN trgm index on text_original for direct linguistic form search (IPA, reconstructed forms)
CREATE INDEX IF NOT EXISTS idx_words_text_original_trgm
  ON words USING gin(text_original gin_trgm_ops);

-- GIN trgm index on language names for language entity search
CREATE INDEX IF NOT EXISTS idx_languages_name_trgm
  ON languages USING gin(name gin_trgm_ops);

-- GIN trgm index on language family names
CREATE INDEX IF NOT EXISTS idx_language_families_name_trgm
  ON language_families USING gin(name gin_trgm_ops);

-- GIN trgm on meanings.gloss for meaning search
CREATE INDEX IF NOT EXISTS idx_meanings_gloss_trgm
  ON meanings USING gin(gloss gin_trgm_ops);

-- B-tree index on is_reconstructed for root filtering
CREATE INDEX IF NOT EXISTS idx_words_is_reconstructed
  ON words(is_reconstructed);
