import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

interface FixtureLanguage {
  name: string;
  iso639_3: string | null;
  stage_label: string;
}

interface FixtureWord {
  text_original: string;
  text_normalized: string;
  text_ascii_folded: string;
  language: string;
}

interface Week2Fixture {
  languageFamily: {
    name: string;
    slug: string;
  };
  languages: FixtureLanguage[];
  words: FixtureWord[];
  source: {
    title: string;
    author: string;
    year: number;
    url: string;
  };
}

function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "postgresql://lexgraph:lexgraph@localhost:5433/lexgraph";
}

function loadFixture(): Week2Fixture {
  const fixturePath = resolve("tests", "fixtures", "week2-lineage.json");
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Week2Fixture;
}

async function main() {
  const client = new Client({ connectionString: getDatabaseUrl() });
  const fixture = loadFixture();
  await client.connect();

  try {
    await client.query("BEGIN");

    const familyResult = await client.query<{ id: string }>(
      `
      INSERT INTO language_families (name, slug)
      VALUES ($1, $2)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
      `,
      [fixture.languageFamily.name, fixture.languageFamily.slug]
    );

    const familyId = familyResult.rows[0].id;

    const languageMap = new Map<string, string>();

    for (const language of fixture.languages) {
      const result = await client.query<{ id: string }>(
        `
        INSERT INTO languages (family_id, name, iso639_3, stage_label)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name, stage_label) DO UPDATE
        SET family_id = EXCLUDED.family_id,
            iso639_3 = EXCLUDED.iso639_3
        RETURNING id
        `,
        [familyId, language.name, language.iso639_3, language.stage_label]
      );

      languageMap.set(language.stage_label, result.rows[0].id);
    }

    const sourceResult = await client.query<{ id: string }>(
      `
      INSERT INTO sources (title, author, year, url, citation)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
      RETURNING id
      `,
      [
        fixture.source.title,
        fixture.source.author,
        fixture.source.year,
        fixture.source.url,
        "Week 2 deterministic fixture"
      ]
    );

    let sourceId = sourceResult.rows[0]?.id;
    if (!sourceId) {
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM sources WHERE title = $1 ORDER BY created_at ASC LIMIT 1",
        [fixture.source.title]
      );
      sourceId = existing.rows[0].id;
    }

    for (const [index, word] of fixture.words.entries()) {
      const languageId = languageMap.get(word.language);
      if (!languageId) {
        throw new Error(`Unknown fixture language stage: ${word.language}`);
      }

      const wordResult = await client.query<{ id: string }>(
        `
        INSERT INTO words (language_id, text_original, text_normalized, text_ascii_folded, notes)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
        RETURNING id
        `,
        [languageId, word.text_original, word.text_normalized, word.text_ascii_folded, `lineage_order:${index + 1}`]
      );

      let wordId = wordResult.rows[0]?.id;
      if (!wordId) {
        const existingWord = await client.query<{ id: string }>(
          "SELECT id FROM words WHERE language_id = $1 AND text_normalized = $2 ORDER BY created_at ASC LIMIT 1",
          [languageId, word.text_normalized]
        );
        wordId = existingWord.rows[0].id;
      }

      await client.query(
        `
        INSERT INTO meanings (word_id, gloss)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [wordId, "male parent"]
      );

      await client.query(
        `
        INSERT INTO word_sources (word_id, source_id, source_locator, extracted_by, confidence)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
        `,
        [wordId, sourceId, `entry-${index + 1}`, "week2-seed", 1.0]
      );
    }

    await client.query("COMMIT");
    console.log("Week 2 seed completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
