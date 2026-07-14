import type { NormalizedImportRecord, RawImportRecord, RelationType } from "./types.js";

function normalizeText(input: string): string {
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function slugify(input: string): string {
  return normalizeText(input).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeOptionalText(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

function toRelationType(value: string | undefined): RelationType | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "EVOLVED_FROM" || normalized === "BORROWED_FROM" || normalized === "COGNATE_WITH") {
    return normalized;
  }

  return null;
}

export function normalizeRecord(raw: RawImportRecord): NormalizedImportRecord {
  const family = raw.family.trim();
  const language = raw.language.trim();
  const stage = raw.stage.trim();
  const wordOriginal = raw.word.trim();
  const wordNormalized = normalizeText(wordOriginal);

  const relatedWordOriginal = normalizeOptionalText(raw.relatedWord);
  const relatedWordNormalized = relatedWordOriginal ? normalizeText(relatedWordOriginal) : null;

  return {
    family,
    familySlug: slugify(family),
    language,
    stage,
    wordOriginal,
    wordNormalized,
    wordAsciiFolded: wordNormalized,
    meaning: normalizeOptionalText(raw.meaning),
    sourceTitle: raw.sourceTitle.trim(),
    sourceAuthor: normalizeOptionalText(raw.sourceAuthor),
    sourceYear: raw.sourceYear ?? null,
    sourceUrl: normalizeOptionalText(raw.sourceUrl),
    sourceLocator: normalizeOptionalText(raw.sourceLocator),
    relationType: toRelationType(raw.relationType),
    relatedWordOriginal,
    relatedWordNormalized,
    relatedWordAsciiFolded: relatedWordNormalized,
    relatedLanguage: normalizeOptionalText(raw.relatedLanguage),
    relatedStage: normalizeOptionalText(raw.relatedStage)
  };
}
