-- Week 2 relational core migration.

DROP TABLE IF EXISTS "Placeholder";

CREATE TABLE IF NOT EXISTS language_families (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  parent_family_id uuid REFERENCES language_families(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_language_families_parent_family_id
  ON language_families(parent_family_id);

CREATE TABLE IF NOT EXISTS languages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id uuid REFERENCES language_families(id) ON DELETE SET NULL,
  name text NOT NULL,
  iso639_3 text,
  stage_label text,
  period_start integer,
  period_end integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_languages_name_stage_label
  ON languages(name, stage_label);

CREATE INDEX IF NOT EXISTS idx_languages_family_id
  ON languages(family_id);

CREATE INDEX IF NOT EXISTS idx_languages_iso639_3
  ON languages(iso639_3);

CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  author text,
  year integer,
  url text,
  license text,
  citation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sources_year
  ON sources(year);

CREATE TABLE IF NOT EXISTS words (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  language_id uuid NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  text_original text NOT NULL,
  text_normalized text NOT NULL,
  text_ascii_folded text NOT NULL,
  lemma text,
  ipa text,
  is_reconstructed boolean NOT NULL DEFAULT false,
  reconstruction_marker text,
  period_label text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce canonical uniqueness in the same language, including null lemma equivalence.
CREATE UNIQUE INDEX IF NOT EXISTS uq_words_language_normalized_lemma
  ON words(language_id, text_normalized, COALESCE(lemma, ''));

CREATE INDEX IF NOT EXISTS idx_words_language_id
  ON words(language_id);

CREATE INDEX IF NOT EXISTS idx_words_is_reconstructed
  ON words(is_reconstructed);

CREATE INDEX IF NOT EXISTS idx_words_text_normalized_trgm
  ON words USING gin(text_normalized gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_words_text_ascii_folded_trgm
  ON words USING gin(text_ascii_folded gin_trgm_ops);

CREATE TABLE IF NOT EXISTS meanings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  word_id uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  gloss text NOT NULL,
  domain text,
  usage_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meanings_word_id
  ON meanings(word_id);

CREATE INDEX IF NOT EXISTS idx_meanings_gloss_trgm
  ON meanings USING gin(gloss gin_trgm_ops);

CREATE TABLE IF NOT EXISTS word_sources (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  word_id uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  source_locator text,
  extracted_by text,
  confidence numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_word_sources_word_source_locator
  ON word_sources(word_id, source_id, COALESCE(source_locator, ''));

CREATE INDEX IF NOT EXISTS idx_word_sources_source_id
  ON word_sources(source_id);
