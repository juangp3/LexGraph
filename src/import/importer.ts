import { appendFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PoolClient } from "pg";
import { dbPool } from "../db/client.js";
import type { Parser } from "./parser.interface.js";
import { deduplicateRecords } from "./deduplicator.js";
import { normalizeRecord } from "./normalizer.js";
import type {
  ImportRejection,
  ImportRunResult,
  NormalizedImportRecord,
  RawImportRecord,
  RelationType
} from "./types.js";
import { validateRecord } from "./validator.js";

interface UpsertContext {
  languageMap: Map<string, string>;
  sourceMap: Map<string, string>;
  wordMap: Map<string, string>;
}

export class ImportPipeline {
  constructor(private readonly parser: Parser) {}

  async run(rejectionLogPath: string = "logs/import-rejections.ndjson"): Promise<ImportRunResult> {
    const rawRecords = await this.parser.parse();
    const normalized = rawRecords.map((record) => normalizeRecord(record));

    const rejections: ImportRejection[] = [];
    const accepted: NormalizedImportRecord[] = [];

    normalized.forEach((record, index) => {
      const errors = validateRecord(index, rawRecords[index], record);
      if (errors.length > 0) {
        rejections.push(...errors);
        return;
      }

      accepted.push(record);
    });

    const dedup = deduplicateRecords(accepted);
    dedup.duplicateIndexes.forEach((dedupIndex) => {
      rejections.push({
        index: dedupIndex,
        code: "DUPLICATE_RECORD",
        message: "Duplicate canonical record skipped by deduplicator",
        record: accepted[dedupIndex]
      });
    });

    const context: UpsertContext = {
      languageMap: new Map<string, string>(),
      sourceMap: new Map<string, string>(),
      wordMap: new Map<string, string>()
    };

    const client = await dbPool.connect();
    let upsertedWords = 0;
    let upsertedEdges = 0;

    try {
      await client.query("BEGIN");

      for (const record of dedup.unique) {
        const languageId = await this.upsertLanguage(client, record, context);
        const sourceId = await this.upsertSource(client, record, context);
        const wordId = await this.upsertWord(client, languageId, record, context);

        if (record.meaning) {
          await this.upsertMeaning(client, wordId, record.meaning);
        }

        await this.upsertWordSource(client, wordId, sourceId, record);
        upsertedWords += 1;
      }

      for (const record of dedup.unique) {
        if (!record.relationType || !record.relatedWordNormalized || !record.relatedLanguage || !record.relatedStage) {
          continue;
        }

        const fromWordId = context.wordMap.get(
          this.wordKey(record.language, record.stage, record.wordNormalized)
        );

        const relatedKey = this.wordKey(record.relatedLanguage, record.relatedStage, record.relatedWordNormalized);
        const toWordId = context.wordMap.get(relatedKey);

        if (!fromWordId || !toWordId) {
          rejections.push({
            index: -1,
            code: "RELATED_WORD_NOT_FOUND",
            message: `Could not resolve relation target for ${record.wordOriginal}`,
            record
          });
          continue;
        }

        const sourceId = await this.upsertSource(client, record, context);
        await this.upsertEdge(client, fromWordId, toWordId, sourceId, record.relationType, record.sourceLocator);
        upsertedEdges += 1;
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    this.writeRejections(rejectionLogPath, rejections);

    return {
      processed: rawRecords.length,
      accepted: dedup.unique.length,
      rejected: rejections.length,
      upsertedWords,
      upsertedEdges,
      rejectionLogPath
    };
  }

  private writeRejections(filePath: string, rejections: ImportRejection[]) {
    const absolute = resolve(filePath);
    writeFileSync(absolute, "", "utf8");

    for (const rejection of rejections) {
      appendFileSync(absolute, `${JSON.stringify(rejection)}\n`, "utf8");
    }
  }

  private familyKey(record: NormalizedImportRecord) {
    return `${record.familySlug}`;
  }

  private languageKey(record: NormalizedImportRecord) {
    return `${record.language}|${record.stage}`;
  }

  private wordKey(language: string, stage: string, normalizedWord: string) {
    return `${language}|${stage}|${normalizedWord}`;
  }

  private sourceKey(record: NormalizedImportRecord) {
    return `${record.sourceTitle}`;
  }

  private async upsertLanguage(client: PoolClient, record: NormalizedImportRecord, context: UpsertContext) {
    const cacheKey = this.languageKey(record);
    const existing = context.languageMap.get(cacheKey);
    if (existing) {
      return existing;
    }

    const familyResult = await client.query<{ id: string }>(
      `
      INSERT INTO language_families (name, slug)
      VALUES ($1, $2)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
      `,
      [record.family, this.familyKey(record)]
    );

    const familyId = familyResult.rows[0].id;

    const languageResult = await client.query<{ id: string }>(
      `
      INSERT INTO languages (family_id, name, stage_label)
      VALUES ($1, $2, $3)
      ON CONFLICT (name, stage_label)
      DO UPDATE SET family_id = EXCLUDED.family_id
      RETURNING id
      `,
      [familyId, record.language, record.stage]
    );

    const languageId = languageResult.rows[0].id;
    context.languageMap.set(cacheKey, languageId);
    return languageId;
  }

  private async upsertSource(client: PoolClient, record: NormalizedImportRecord, context: UpsertContext) {
    const cacheKey = this.sourceKey(record);
    const existing = context.sourceMap.get(cacheKey);
    if (existing) {
      return existing;
    }

    const inserted = await client.query<{ id: string }>(
      `
      INSERT INTO sources (title, author, year, url, citation)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
      RETURNING id
      `,
      [record.sourceTitle, record.sourceAuthor, record.sourceYear, record.sourceUrl, "week4-import"]
    );

    let sourceId = inserted.rows[0]?.id;
    if (!sourceId) {
      const existingSource = await client.query<{ id: string }>(
        `SELECT id FROM sources WHERE title = $1 ORDER BY created_at ASC LIMIT 1`,
        [record.sourceTitle]
      );
      sourceId = existingSource.rows[0].id;
    }

    context.sourceMap.set(cacheKey, sourceId);
    return sourceId;
  }

  private async upsertWord(
    client: PoolClient,
    languageId: string,
    record: NormalizedImportRecord,
    context: UpsertContext
  ) {
    const cacheKey = this.wordKey(record.language, record.stage, record.wordNormalized);
    const existing = context.wordMap.get(cacheKey);
    if (existing) {
      return existing;
    }

    const inserted = await client.query<{ id: string }>(
      `
      INSERT INTO words (language_id, text_original, text_normalized, text_ascii_folded)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
      RETURNING id
      `,
      [languageId, record.wordOriginal, record.wordNormalized, record.wordAsciiFolded]
    );

    let wordId = inserted.rows[0]?.id;
    if (!wordId) {
      const existingWord = await client.query<{ id: string }>(
        `
        SELECT id
        FROM words
        WHERE language_id = $1
          AND text_normalized = $2
        ORDER BY created_at ASC
        LIMIT 1
        `,
        [languageId, record.wordNormalized]
      );
      wordId = existingWord.rows[0].id;
    }

    context.wordMap.set(cacheKey, wordId);
    return wordId;
  }

  private async upsertMeaning(client: PoolClient, wordId: string, gloss: string) {
    await client.query(
      `
      INSERT INTO meanings (word_id, gloss)
      SELECT $1, $2
      WHERE NOT EXISTS (
        SELECT 1 FROM meanings WHERE word_id = $1 AND gloss = $2
      )
      `,
      [wordId, gloss]
    );
  }

  private async upsertWordSource(client: PoolClient, wordId: string, sourceId: string, record: NormalizedImportRecord) {
    await client.query(
      `
      INSERT INTO word_sources (word_id, source_id, source_locator, extracted_by, confidence)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
      `,
      [wordId, sourceId, record.sourceLocator, "week4-import", 1.0]
    );
  }

  private async upsertEdge(
    client: PoolClient,
    fromWordId: string,
    toWordId: string,
    sourceId: string,
    relationType: RelationType,
    sourceLocator: string | null
  ) {
    const edgeResult = await client.query<{ id: string }>(
      `
      INSERT INTO etymology_edges (
        from_word_id,
        to_word_id,
        relation_type,
        confidence,
        evidence_summary,
        method,
        is_disputed,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (from_word_id, to_word_id, relation_type)
      DO UPDATE SET
        confidence = EXCLUDED.confidence,
        evidence_summary = EXCLUDED.evidence_summary,
        method = EXCLUDED.method,
        updated_at = now()
      RETURNING id
      `,
      [
        fromWordId,
        toWordId,
        relationType,
        0.9,
        "Imported by week4 pipeline",
        "imported",
        false,
        "week4-import"
      ]
    );

    const edgeId = edgeResult.rows[0].id;

    await client.query(
      `
      INSERT INTO edge_sources (edge_id, source_id, source_locator, quote_excerpt)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
      `,
      [edgeId, sourceId, sourceLocator, "week4-import relation"]
    );
  }
}
