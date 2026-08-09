import { dbPool } from "../db/client.js";
import type {
  NoteTargetType,
  RecentViewItem,
  SavedGraph,
  SavedWord,
  SearchHistoryItem,
  WorkspaceCollection,
  WorkspaceNote,
  WorkspacePreferences,
  WorkspaceSearchResult,
  WorkspaceStore,
  WorkspaceSummary,
} from "./types.js";

function toCursor(timestamp: string, id: string): string {
  return Buffer.from(`${timestamp}|${id}`, "utf8").toString("base64url");
}

function parseCursor(cursor: string | undefined): { timestamp: string; id: string } | null {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const [timestamp, id] = decoded.split("|");
    if (!timestamp || !id) {
      return null;
    }

    return { timestamp, id };
  } catch {
    return null;
  }
}

function mapSavedWord(row: Record<string, unknown>): SavedWord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    wordId: String(row.word_id),
    textOriginal: row.text_original ? String(row.text_original) : "",
    language: row.language_name ? String(row.language_name) : null,
    stage: row.stage_label ? String(row.stage_label) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapCollection(row: Record<string, unknown>): WorkspaceCollection {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    position: Number(row.position ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapNote(row: Record<string, unknown>): WorkspaceNote {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    targetType: String(row.target_type) as NoteTargetType,
    targetId: String(row.target_id),
    content: String(row.content),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapGraph(row: Record<string, unknown>): SavedGraph {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    rootEntityId: String(row.root_entity_id),
    title: String(row.title),
    depth: Number(row.depth),
    filters: row.filters ?? {},
    layoutPreference: row.layout_preference ? String(row.layout_preference) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapHistory(row: Record<string, unknown>): SearchHistoryItem {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    query: String(row.query),
    searchedAt: String(row.searched_at),
  };
}

function mapRecent(row: Record<string, unknown>): RecentViewItem {
  return {
    userId: String(row.user_id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    viewedAt: String(row.viewed_at),
  };
}

function mapPreferences(row: Record<string, unknown>): WorkspacePreferences {
  return {
    userId: String(row.user_id),
    theme: String(row.theme),
    interfaceLanguage: String(row.interface_language),
    defaultGraphDepth: Number(row.default_graph_depth),
    graphLayout: String(row.graph_layout),
    showMeanings: Boolean(row.show_meanings),
    showSources: Boolean(row.show_sources),
    updatedAt: String(row.updated_at),
  };
}

export class PgWorkspaceStore implements WorkspaceStore {
  async listSavedWords(userId: string, limit: number, cursor?: string): Promise<{ items: SavedWord[]; nextCursor: string | null }> {
    const parsedCursor = parseCursor(cursor);
    const values: unknown[] = [userId, limit + 1];
    let cursorClause = "";
    if (parsedCursor) {
      values.push(parsedCursor.timestamp, parsedCursor.id);
      cursorClause = "AND (sw.created_at, sw.id) < ($3::timestamptz, $4::uuid)";
    }

    const rows = await dbPool.query(
      `
      SELECT sw.id, sw.user_id, sw.word_id, sw.created_at, sw.updated_at, w.text_original, l.name AS language_name, l.stage_label
      FROM saved_words sw
      LEFT JOIN words w ON w.id = sw.word_id
      LEFT JOIN languages l ON l.id = w.language_id
      WHERE sw.user_id = $1
      ${cursorClause}
      ORDER BY sw.created_at DESC, sw.id DESC
      LIMIT $2
      `,
      values,
    );

    const mapped = rows.rows.map((row) => mapSavedWord(row as Record<string, unknown>));
    const hasMore = mapped.length > limit;
    const items = hasMore ? mapped.slice(0, limit) : mapped;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? toCursor(last.createdAt, last.id) : null,
    };
  }

  async saveWord(userId: string, wordId: string): Promise<SavedWord> {
    const result = await dbPool.query(
      `
      INSERT INTO saved_words (user_id, word_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, word_id)
      DO UPDATE SET updated_at = now()
      RETURNING id, user_id, word_id, created_at, updated_at
      `,
      [userId, wordId],
    );

    const saved = mapSavedWord(result.rows[0] as Record<string, unknown>);
    const details = await dbPool.query(
      `
      SELECT w.text_original, l.name AS language_name, l.stage_label
      FROM words w
      LEFT JOIN languages l ON l.id = w.language_id
      WHERE w.id = $1
      `,
      [wordId],
    );

    const detailRow = details.rows[0] as Record<string, unknown> | undefined;
    return {
      ...saved,
      textOriginal: detailRow?.text_original ? String(detailRow.text_original) : "",
      language: detailRow?.language_name ? String(detailRow.language_name) : null,
      stage: detailRow?.stage_label ? String(detailRow.stage_label) : null,
    };
  }

  async listBookmarks(userId: string, limit: number, cursor?: string): Promise<{ items: SavedWord[]; nextCursor: string | null }> {
    return this.listSavedWords(userId, limit, cursor);
  }

  async saveBookmark(userId: string, wordId: string): Promise<SavedWord> {
    return this.saveWord(userId, wordId);
  }

  async deleteBookmark(userId: string, bookmarkId: string): Promise<boolean> {
    return this.deleteSavedWord(userId, bookmarkId);
  }

  async deleteSavedWord(userId: string, savedWordId: string): Promise<boolean> {
    const result = await dbPool.query(`DELETE FROM saved_words WHERE user_id = $1 AND id = $2`, [userId, savedWordId]);
    return (result.rowCount ?? 0) > 0;
  }

  async listCollections(userId: string): Promise<WorkspaceCollection[]> {
    const result = await dbPool.query(
      `
      SELECT id, user_id, name, description, position, created_at, updated_at
      FROM collections
      WHERE user_id = $1
      ORDER BY position ASC, created_at ASC
      `,
      [userId],
    );

    return result.rows.map((row) => mapCollection(row as Record<string, unknown>));
  }

  async createCollection(userId: string, input: { name: string; description: string | null }): Promise<WorkspaceCollection> {
    const result = await dbPool.query(
      `
      INSERT INTO collections (user_id, name, description, position)
      VALUES ($1, $2, $3, COALESCE((SELECT MAX(position) + 1 FROM collections WHERE user_id = $1), 0))
      RETURNING id, user_id, name, description, position, created_at, updated_at
      `,
      [userId, input.name, input.description],
    );

    return mapCollection(result.rows[0] as Record<string, unknown>);
  }

  async updateCollection(
    userId: string,
    collectionId: string,
    input: { name?: string; description?: string | null; position?: number },
  ): Promise<WorkspaceCollection | null> {
    const fields: string[] = [];
    const values: unknown[] = [userId, collectionId];

    if (input.name !== undefined) {
      values.push(input.name);
      fields.push(`name = $${values.length}`);
    }
    if (input.description !== undefined) {
      values.push(input.description);
      fields.push(`description = $${values.length}`);
    }
    if (input.position !== undefined) {
      values.push(input.position);
      fields.push(`position = $${values.length}`);
    }

    if (fields.length === 0) {
      const existing = await dbPool.query(
        `SELECT id, user_id, name, description, position, created_at, updated_at FROM collections WHERE user_id = $1 AND id = $2`,
        [userId, collectionId],
      );
      if (existing.rows.length === 0) {
        return null;
      }
      return mapCollection(existing.rows[0] as Record<string, unknown>);
    }

    const result = await dbPool.query(
      `
      UPDATE collections
      SET ${fields.join(", ")}, updated_at = now()
      WHERE user_id = $1 AND id = $2
      RETURNING id, user_id, name, description, position, created_at, updated_at
      `,
      values,
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapCollection(result.rows[0] as Record<string, unknown>);
  }

  async deleteCollection(userId: string, collectionId: string): Promise<boolean> {
    const result = await dbPool.query(`DELETE FROM collections WHERE user_id = $1 AND id = $2`, [userId, collectionId]);
    return (result.rowCount ?? 0) > 0;
  }

  async addSavedWordToCollection(userId: string, savedWordId: string, collectionId: string): Promise<boolean> {
    const result = await dbPool.query(
      `
      INSERT INTO collection_saved_words (collection_id, saved_word_id)
      SELECT c.id, sw.id
      FROM collections c
      INNER JOIN saved_words sw ON sw.user_id = c.user_id
      WHERE c.user_id = $1 AND c.id = $2 AND sw.id = $3
      ON CONFLICT (collection_id, saved_word_id) DO NOTHING
      RETURNING collection_id
      `,
      [userId, collectionId, savedWordId],
    );

    if ((result.rowCount ?? 0) > 0) {
      return true;
    }

    const ownershipCheck = await dbPool.query(
      `
      SELECT
        EXISTS(SELECT 1 FROM collections WHERE user_id = $1 AND id = $2) AS collection_exists,
        EXISTS(SELECT 1 FROM saved_words WHERE user_id = $1 AND id = $3) AS saved_word_exists
      `,
      [userId, collectionId, savedWordId],
    );

    const row = ownershipCheck.rows[0] as { collection_exists: boolean; saved_word_exists: boolean } | undefined;
    return Boolean(row?.collection_exists && row?.saved_word_exists);
  }

  async removeSavedWordFromCollection(userId: string, savedWordId: string, collectionId: string): Promise<boolean> {
    const result = await dbPool.query(
      `
      DELETE FROM collection_saved_words csm
      USING collections c, saved_words sw
      WHERE csm.collection_id = c.id
        AND csm.saved_word_id = sw.id
        AND c.user_id = $1
        AND sw.user_id = $1
        AND c.id = $2
        AND sw.id = $3
      `,
      [userId, collectionId, savedWordId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async bulkAddSavedWordsToCollection(userId: string, savedWordIds: string[], collectionId: string): Promise<{ added: number; notFound: number }> {
    const insertResult = await dbPool.query(
      `
      WITH target_collection AS (
        SELECT id
        FROM collections
        WHERE user_id = $1 AND id = $2
      ), valid_saved_words AS (
        SELECT sw.id
        FROM saved_words sw
        WHERE sw.user_id = $1
          AND sw.id = ANY($3::uuid[])
      ), inserted AS (
        INSERT INTO collection_saved_words (collection_id, saved_word_id)
        SELECT tc.id, vsw.id
        FROM target_collection tc
        CROSS JOIN valid_saved_words vsw
        ON CONFLICT (collection_id, saved_word_id) DO NOTHING
        RETURNING 1
      )
      SELECT (SELECT COUNT(*)::int FROM inserted) AS added,
             (SELECT COUNT(*)::int FROM valid_saved_words) AS found
      `,
      [userId, collectionId, savedWordIds],
    );

    const row = insertResult.rows[0] as Record<string, unknown>;
    const added = Number(row.added ?? 0);
    const found = Number(row.found ?? 0);
    return {
      added,
      notFound: Math.max(0, savedWordIds.length - found),
    };
  }

  async bulkRemoveSavedWordsFromCollection(userId: string, savedWordIds: string[], collectionId: string): Promise<{ removed: number }> {
    const result = await dbPool.query(
      `
      DELETE FROM collection_saved_words csm
      USING collections c, saved_words sw
      WHERE csm.collection_id = c.id
        AND csm.saved_word_id = sw.id
        AND c.user_id = $1
        AND sw.user_id = $1
        AND c.id = $2
        AND sw.id = ANY($3::uuid[])
      `,
      [userId, collectionId, savedWordIds],
    );

    return { removed: Number(result.rowCount ?? 0) };
  }

  async listNotes(userId: string, limit: number, cursor?: string): Promise<{ items: WorkspaceNote[]; nextCursor: string | null }> {
    const parsedCursor = parseCursor(cursor);
    const values: unknown[] = [userId, limit + 1];
    let cursorClause = "";
    if (parsedCursor) {
      values.push(parsedCursor.timestamp, parsedCursor.id);
      cursorClause = "AND (n.updated_at, n.id) < ($3::timestamptz, $4::uuid)";
    }

    const result = await dbPool.query(
      `
      SELECT n.id, n.user_id, n.target_type, n.target_id, n.content, n.created_at, n.updated_at
      FROM notes n
      WHERE n.user_id = $1
      ${cursorClause}
      ORDER BY n.updated_at DESC, n.id DESC
      LIMIT $2
      `,
      values,
    );

    const mapped = result.rows.map((row) => mapNote(row as Record<string, unknown>));
    const hasMore = mapped.length > limit;
    const items = hasMore ? mapped.slice(0, limit) : mapped;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? toCursor(last.updatedAt, last.id) : null,
    };
  }

  async createNote(userId: string, input: { targetType: NoteTargetType; targetId: string; content: string }): Promise<WorkspaceNote> {
    const result = await dbPool.query(
      `
      INSERT INTO notes (user_id, target_type, target_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, target_type, target_id, content, created_at, updated_at
      `,
      [userId, input.targetType, input.targetId, input.content],
    );

    return mapNote(result.rows[0] as Record<string, unknown>);
  }

  async updateNote(userId: string, noteId: string, content: string): Promise<WorkspaceNote | null> {
    const result = await dbPool.query(
      `
      UPDATE notes SET content = $3, updated_at = now()
      WHERE user_id = $1 AND id = $2
      RETURNING id, user_id, target_type, target_id, content, created_at, updated_at
      `,
      [userId, noteId, content],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapNote(result.rows[0] as Record<string, unknown>);
  }

  async deleteNote(userId: string, noteId: string): Promise<boolean> {
    const result = await dbPool.query(`DELETE FROM notes WHERE user_id = $1 AND id = $2`, [userId, noteId]);
    return (result.rowCount ?? 0) > 0;
  }

  async bulkDeleteNotes(userId: string, noteIds: string[]): Promise<{ deleted: number }> {
    const result = await dbPool.query(
      `DELETE FROM notes WHERE user_id = $1 AND id = ANY($2::uuid[])`,
      [userId, noteIds],
    );

    return { deleted: Number(result.rowCount ?? 0) };
  }

  async listSavedGraphs(userId: string, limit: number, cursor?: string): Promise<{ items: SavedGraph[]; nextCursor: string | null }> {
    const parsedCursor = parseCursor(cursor);
    const values: unknown[] = [userId, limit + 1];
    let cursorClause = "";
    if (parsedCursor) {
      values.push(parsedCursor.timestamp, parsedCursor.id);
      cursorClause = "AND (sg.updated_at, sg.id) < ($3::timestamptz, $4::uuid)";
    }

    const result = await dbPool.query(
      `
      SELECT id, user_id, root_entity_id, title, depth, filters, layout_preference, created_at, updated_at
      FROM saved_graphs sg
      WHERE user_id = $1
      ${cursorClause}
      ORDER BY updated_at DESC, id DESC
      LIMIT $2
      `,
      values,
    );

    const mapped = result.rows.map((row) => mapGraph(row as Record<string, unknown>));
    const hasMore = mapped.length > limit;
    const items = hasMore ? mapped.slice(0, limit) : mapped;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? toCursor(last.updatedAt, last.id) : null,
    };
  }

  async createSavedGraph(
    userId: string,
    input: { rootEntityId: string; title: string; depth: number; filters: unknown; layoutPreference: string | null },
  ): Promise<SavedGraph> {
    const result = await dbPool.query(
      `
      INSERT INTO saved_graphs (user_id, root_entity_id, title, depth, filters, layout_preference)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      RETURNING id, user_id, root_entity_id, title, depth, filters, layout_preference, created_at, updated_at
      `,
      [userId, input.rootEntityId, input.title, input.depth, JSON.stringify(input.filters ?? {}), input.layoutPreference],
    );

    return mapGraph(result.rows[0] as Record<string, unknown>);
  }

  async updateSavedGraphTitle(userId: string, graphId: string, title: string): Promise<SavedGraph | null> {
    const result = await dbPool.query(
      `
      UPDATE saved_graphs
      SET title = $3, updated_at = now()
      WHERE user_id = $1 AND id = $2
      RETURNING id, user_id, root_entity_id, title, depth, filters, layout_preference, created_at, updated_at
      `,
      [userId, graphId, title],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapGraph(result.rows[0] as Record<string, unknown>);
  }

  async deleteSavedGraph(userId: string, graphId: string): Promise<boolean> {
    const result = await dbPool.query(`DELETE FROM saved_graphs WHERE user_id = $1 AND id = $2`, [userId, graphId]);
    return (result.rowCount ?? 0) > 0;
  }

  async listHistory(userId: string, limit: number, cursor?: string): Promise<{ items: SearchHistoryItem[]; nextCursor: string | null }> {
    const parsedCursor = parseCursor(cursor);
    const values: unknown[] = [userId, limit + 1];
    let cursorClause = "";
    if (parsedCursor) {
      values.push(parsedCursor.timestamp, parsedCursor.id);
      cursorClause = "AND (h.searched_at, h.id) < ($3::timestamptz, $4::uuid)";
    }

    const result = await dbPool.query(
      `
      SELECT h.id, h.user_id, h.query, h.searched_at
      FROM search_history h
      WHERE h.user_id = $1
      ${cursorClause}
      ORDER BY h.searched_at DESC, h.id DESC
      LIMIT $2
      `,
      values,
    );

    const mapped = result.rows.map((row) => mapHistory(row as Record<string, unknown>));
    const hasMore = mapped.length > limit;
    const items = hasMore ? mapped.slice(0, limit) : mapped;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? toCursor(last.searchedAt, last.id) : null,
    };
  }

  async addHistory(userId: string, query: string): Promise<void> {
    await dbPool.query(`INSERT INTO search_history (user_id, query) VALUES ($1, $2)`, [userId, query]);
    await dbPool.query(
      `
      DELETE FROM search_history
      WHERE id IN (
        SELECT id FROM search_history
        WHERE user_id = $1
        ORDER BY searched_at DESC, id DESC
        OFFSET 500
      )
      `,
      [userId],
    );
  }

  async clearHistory(userId: string): Promise<void> {
    await dbPool.query(`DELETE FROM search_history WHERE user_id = $1`, [userId]);
  }

  async listRecentViews(userId: string, limit: number): Promise<RecentViewItem[]> {
    const result = await dbPool.query(
      `
      SELECT user_id, entity_type, entity_id, viewed_at
      FROM recent_views
      WHERE user_id = $1
      ORDER BY viewed_at DESC
      LIMIT $2
      `,
      [userId, limit],
    );

    return result.rows.map((row) => mapRecent(row as Record<string, unknown>));
  }

  async upsertRecentView(userId: string, input: { entityType: string; entityId: string }): Promise<void> {
    await dbPool.query(
      `
      INSERT INTO recent_views (user_id, entity_type, entity_id, viewed_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (user_id, entity_type, entity_id)
      DO UPDATE SET viewed_at = EXCLUDED.viewed_at
      `,
      [userId, input.entityType, input.entityId],
    );

    await dbPool.query(
      `
      DELETE FROM recent_views
      WHERE (user_id, entity_type, entity_id) IN (
        SELECT user_id, entity_type, entity_id
        FROM recent_views
        WHERE user_id = $1
        ORDER BY viewed_at DESC
        OFFSET 100
      )
      `,
      [userId],
    );
  }

  async getPreferences(userId: string): Promise<WorkspacePreferences> {
    const existing = await dbPool.query(
      `
      SELECT user_id, theme, interface_language, default_graph_depth, graph_layout, show_meanings, show_sources, updated_at
      FROM user_preferences
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    if (existing.rows.length > 0) {
      return mapPreferences(existing.rows[0] as Record<string, unknown>);
    }

    const created = await dbPool.query(
      `
      INSERT INTO user_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO UPDATE SET updated_at = user_preferences.updated_at
      RETURNING user_id, theme, interface_language, default_graph_depth, graph_layout, show_meanings, show_sources, updated_at
      `,
      [userId],
    );

    return mapPreferences(created.rows[0] as Record<string, unknown>);
  }

  async updatePreferences(
    userId: string,
    patch: Partial<{
      theme: string;
      interfaceLanguage: string;
      defaultGraphDepth: number;
      graphLayout: string;
      showMeanings: boolean;
      showSources: boolean;
    }>,
  ): Promise<WorkspacePreferences> {
    await this.getPreferences(userId);

    const fields: string[] = [];
    const values: unknown[] = [userId];

    if (patch.theme !== undefined) {
      values.push(patch.theme);
      fields.push(`theme = $${values.length}`);
    }
    if (patch.interfaceLanguage !== undefined) {
      values.push(patch.interfaceLanguage);
      fields.push(`interface_language = $${values.length}`);
    }
    if (patch.defaultGraphDepth !== undefined) {
      values.push(patch.defaultGraphDepth);
      fields.push(`default_graph_depth = $${values.length}`);
    }
    if (patch.graphLayout !== undefined) {
      values.push(patch.graphLayout);
      fields.push(`graph_layout = $${values.length}`);
    }
    if (patch.showMeanings !== undefined) {
      values.push(patch.showMeanings);
      fields.push(`show_meanings = $${values.length}`);
    }
    if (patch.showSources !== undefined) {
      values.push(patch.showSources);
      fields.push(`show_sources = $${values.length}`);
    }

    if (fields.length === 0) {
      return this.getPreferences(userId);
    }

    const result = await dbPool.query(
      `
      UPDATE user_preferences
      SET ${fields.join(", ")}, updated_at = now()
      WHERE user_id = $1
      RETURNING user_id, theme, interface_language, default_graph_depth, graph_layout, show_meanings, show_sources, updated_at
      `,
      values,
    );

    return mapPreferences(result.rows[0] as Record<string, unknown>);
  }

  async getSummary(userId: string): Promise<WorkspaceSummary> {
    const [countsResult, recent] = await Promise.all([
      dbPool.query(
        `
        SELECT
          (SELECT COUNT(*)::int FROM saved_words WHERE user_id = $1) AS saved_words,
          (SELECT COUNT(*)::int FROM saved_graphs WHERE user_id = $1) AS saved_graphs,
          (SELECT COUNT(*)::int FROM collections WHERE user_id = $1) AS collections,
          (SELECT COUNT(*)::int FROM notes WHERE user_id = $1) AS notes
        `,
        [userId],
      ),
      this.listRecentViews(userId, 10),
    ]);

    const row = countsResult.rows[0] as Record<string, unknown>;
    return {
      savedWords: Number(row.saved_words ?? 0),
      savedGraphs: Number(row.saved_graphs ?? 0),
      collections: Number(row.collections ?? 0),
      notes: Number(row.notes ?? 0),
      recent,
    };
  }

  async getCollectionMemberships(userId: string): Promise<Record<string, string[]>> {
    const result = await dbPool.query(
      `
      SELECT csm.saved_word_id, csm.collection_id
      FROM collection_saved_words csm
      INNER JOIN saved_words sw ON sw.id = csm.saved_word_id
      INNER JOIN collections c ON c.id = csm.collection_id
      WHERE sw.user_id = $1 AND c.user_id = $1
      `,
      [userId],
    );

    const map: Record<string, string[]> = {};
    for (const row of result.rows as Array<Record<string, unknown>>) {
      const savedWordId = String(row.saved_word_id);
      const collectionId = String(row.collection_id);
      if (!map[savedWordId]) {
        map[savedWordId] = [];
      }
      map[savedWordId].push(collectionId);
    }

    return map;
  }

  async searchWorkspace(userId: string, query: string, limit: number): Promise<WorkspaceSearchResult> {
    const like = `%${query}%`;
    const [wordsResult, collectionsResult, notesResult, graphsResult] = await Promise.all([
      dbPool.query(
        `
        SELECT sw.id, sw.user_id, sw.word_id, sw.created_at, sw.updated_at, w.text_original, l.name AS language_name, l.stage_label
        FROM saved_words sw
        LEFT JOIN words w ON w.id = sw.word_id
        LEFT JOIN languages l ON l.id = w.language_id
        WHERE sw.user_id = $1
          AND (
            COALESCE(w.text_original, '') ILIKE $2
            OR COALESCE(l.name, '') ILIKE $2
            OR COALESCE(l.stage_label, '') ILIKE $2
          )
        ORDER BY sw.updated_at DESC, sw.id DESC
        LIMIT $3
        `,
        [userId, like, limit],
      ),
      dbPool.query(
        `
        SELECT id, user_id, name, description, position, created_at, updated_at
        FROM collections
        WHERE user_id = $1
          AND (name ILIKE $2 OR COALESCE(description, '') ILIKE $2)
        ORDER BY updated_at DESC, id DESC
        LIMIT $3
        `,
        [userId, like, limit],
      ),
      dbPool.query(
        `
        SELECT id, user_id, target_type, target_id, content, created_at, updated_at
        FROM notes
        WHERE user_id = $1
          AND content ILIKE $2
        ORDER BY updated_at DESC, id DESC
        LIMIT $3
        `,
        [userId, like, limit],
      ),
      dbPool.query(
        `
        SELECT id, user_id, root_entity_id, title, depth, filters, layout_preference, created_at, updated_at
        FROM saved_graphs
        WHERE user_id = $1
          AND title ILIKE $2
        ORDER BY updated_at DESC, id DESC
        LIMIT $3
        `,
        [userId, like, limit],
      ),
    ]);

    return {
      words: wordsResult.rows.map((row) => mapSavedWord(row as Record<string, unknown>)),
      collections: collectionsResult.rows.map((row) => mapCollection(row as Record<string, unknown>)),
      notes: notesResult.rows.map((row) => mapNote(row as Record<string, unknown>)),
      graphs: graphsResult.rows.map((row) => mapGraph(row as Record<string, unknown>)),
    };
  }
}
