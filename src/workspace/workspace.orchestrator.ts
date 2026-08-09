import type {
  NoteTargetType,
  WorkspaceExportPayload,
  WorkspaceImportPayload,
  WorkspaceStore,
} from "./types.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_COLLECTIONS = 100;
const MAX_COLLECTION_NAME_LENGTH = 100;
const MAX_COLLECTION_DESCRIPTION_LENGTH = 1000;
const MAX_NOTE_CONTENT_LENGTH = 20_000;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const MAX_IMPORT_COLLECTIONS = 1_000;
const MAX_IMPORT_SAVED_WORDS = 50_000;
const MAX_IMPORT_SAVED_GRAPHS = 5_000;
const MAX_IMPORT_NOTES = 50_000;
const MAX_WORKSPACE_SEARCH_QUERY_LENGTH = 200;

export class WorkspaceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
    this.name = "WorkspaceError";
  }
}

function ensureUuid(value: string, code: string, message: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new WorkspaceError(code, message);
  }
}

function sanitizeListLimit(rawLimit: number | undefined): number {
  if (!Number.isFinite(rawLimit)) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIST_LIMIT, Math.floor(rawLimit as number)));
}

function sanitizeUuidList(values: unknown, code: string, message: string): string[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new WorkspaceError(code, message);
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const id = String(value ?? "");
    ensureUuid(id, code, message);
    if (!seen.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  }

  return normalized;
}

function sanitizeCollectionName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new WorkspaceError("INVALID_COLLECTION", "Collection name is required.");
  }

  if (normalized.length > MAX_COLLECTION_NAME_LENGTH) {
    throw new WorkspaceError("INVALID_COLLECTION", `Collection name exceeds ${MAX_COLLECTION_NAME_LENGTH} characters.`);
  }

  return normalized;
}

function sanitizeCollectionDescription(description: string | null | undefined): string | null {
  if (description == null) {
    return null;
  }

  const normalized = description.trim();
  if (normalized.length > MAX_COLLECTION_DESCRIPTION_LENGTH) {
    throw new WorkspaceError("INVALID_COLLECTION", `Collection description exceeds ${MAX_COLLECTION_DESCRIPTION_LENGTH} characters.`);
  }

  return normalized.length > 0 ? normalized : null;
}

function sanitizeNoteContent(content: string): string {
  const normalized = content.trim();
  if (!normalized) {
    throw new WorkspaceError("INVALID_NOTE", "Note content is required.");
  }

  if (normalized.length > MAX_NOTE_CONTENT_LENGTH) {
    throw new WorkspaceError("INVALID_NOTE", `Note content exceeds ${MAX_NOTE_CONTENT_LENGTH} characters.`);
  }

  return normalized;
}

function ensureTargetType(type: string): NoteTargetType {
  const value = type.toUpperCase();
  if (!["WORD", "LANGUAGE", "RELATIONSHIP", "GRAPH", "COLLECTION"].includes(value)) {
    throw new WorkspaceError("INVALID_NOTE", "Invalid note targetType.");
  }

  return value as NoteTargetType;
}

export class WorkspaceOrchestrator {
  constructor(private readonly store: WorkspaceStore) {}

  async listSavedWords(userId: string, input: { limit?: number; cursor?: string }) {
    return this.store.listSavedWords(userId, sanitizeListLimit(input.limit), input.cursor);
  }

  async saveWord(userId: string, wordId: string) {
    ensureUuid(wordId, "INVALID_WORD_ID", "wordId must be a UUID.");
    return this.store.saveWord(userId, wordId);
  }

  async listBookmarks(userId: string, input: { limit?: number; cursor?: string }) {
    return this.store.listBookmarks(userId, sanitizeListLimit(input.limit), input.cursor);
  }

  async saveBookmark(userId: string, wordId: string) {
    ensureUuid(wordId, "INVALID_WORD_ID", "wordId must be a UUID.");
    return this.store.saveBookmark(userId, wordId);
  }

  async deleteBookmark(userId: string, bookmarkId: string) {
    ensureUuid(bookmarkId, "INVALID_BOOKMARK_ID", "bookmarkId must be a UUID.");
    return this.store.deleteBookmark(userId, bookmarkId);
  }

  async deleteSavedWord(userId: string, savedWordId: string) {
    ensureUuid(savedWordId, "INVALID_SAVED_WORD_ID", "savedWordId must be a UUID.");
    return this.store.deleteSavedWord(userId, savedWordId);
  }

  async listCollections(userId: string) {
    return this.store.listCollections(userId);
  }

  async createCollection(userId: string, input: { name: string; description?: string | null }) {
    const collections = await this.store.listCollections(userId);
    if (collections.length >= MAX_COLLECTIONS) {
      throw new WorkspaceError("COLLECTION_LIMIT_REACHED", "Collection limit reached.", 409);
    }

    const name = sanitizeCollectionName(input.name);
    const description = sanitizeCollectionDescription(input.description);

    return this.store.createCollection(userId, { name, description });
  }

  async updateCollection(userId: string, collectionId: string, input: { name?: string; description?: string | null; position?: number }) {
    ensureUuid(collectionId, "INVALID_COLLECTION", "collectionId must be a UUID.");

    const patch: { name?: string; description?: string | null; position?: number } = {};
    if (input.name !== undefined) {
      patch.name = sanitizeCollectionName(input.name);
    }
    if (input.description !== undefined) {
      patch.description = sanitizeCollectionDescription(input.description);
    }
    if (input.position !== undefined) {
      patch.position = Math.max(0, Math.floor(input.position));
    }

    const updated = await this.store.updateCollection(userId, collectionId, patch);
    if (!updated) {
      throw new WorkspaceError("COLLECTION_NOT_FOUND", "Collection not found.", 404);
    }

    return updated;
  }

  async deleteCollection(userId: string, collectionId: string) {
    ensureUuid(collectionId, "INVALID_COLLECTION", "collectionId must be a UUID.");
    const deleted = await this.store.deleteCollection(userId, collectionId);
    if (!deleted) {
      throw new WorkspaceError("COLLECTION_NOT_FOUND", "Collection not found.", 404);
    }
  }

  async addSavedWordToCollection(userId: string, savedWordId: string, collectionId: string) {
    ensureUuid(savedWordId, "INVALID_SAVED_WORD_ID", "savedWordId must be a UUID.");
    ensureUuid(collectionId, "INVALID_COLLECTION", "collectionId must be a UUID.");

    const linked = await this.store.addSavedWordToCollection(userId, savedWordId, collectionId);
    if (!linked) {
      throw new WorkspaceError("RESOURCE_NOT_FOUND", "Saved word or collection not found.", 404);
    }
  }

  async removeSavedWordFromCollection(userId: string, savedWordId: string, collectionId: string) {
    ensureUuid(savedWordId, "INVALID_SAVED_WORD_ID", "savedWordId must be a UUID.");
    ensureUuid(collectionId, "INVALID_COLLECTION", "collectionId must be a UUID.");

    await this.store.removeSavedWordFromCollection(userId, savedWordId, collectionId);
  }

  async bulkAddSavedWordsToCollection(userId: string, input: { collectionId: string; savedWordIds: unknown }) {
    ensureUuid(input.collectionId, "INVALID_COLLECTION", "collectionId must be a UUID.");
    const savedWordIds = sanitizeUuidList(input.savedWordIds, "INVALID_SAVED_WORD_ID", "savedWordIds must contain UUID values.");
    return this.store.bulkAddSavedWordsToCollection(userId, savedWordIds, input.collectionId);
  }

  async bulkRemoveSavedWordsFromCollection(userId: string, input: { collectionId: string; savedWordIds: unknown }) {
    ensureUuid(input.collectionId, "INVALID_COLLECTION", "collectionId must be a UUID.");
    const savedWordIds = sanitizeUuidList(input.savedWordIds, "INVALID_SAVED_WORD_ID", "savedWordIds must contain UUID values.");
    return this.store.bulkRemoveSavedWordsFromCollection(userId, savedWordIds, input.collectionId);
  }

  async listNotes(userId: string, input: { limit?: number; cursor?: string }) {
    return this.store.listNotes(userId, sanitizeListLimit(input.limit), input.cursor);
  }

  async createNote(userId: string, input: { targetType: string; targetId: string; content: string }) {
    ensureUuid(input.targetId, "INVALID_NOTE", "targetId must be a UUID.");
    const targetType = ensureTargetType(input.targetType);
    const content = sanitizeNoteContent(input.content);

    return this.store.createNote(userId, { targetType, targetId: input.targetId, content });
  }

  async updateNote(userId: string, noteId: string, content: string) {
    ensureUuid(noteId, "INVALID_NOTE", "noteId must be a UUID.");
    const sanitized = sanitizeNoteContent(content);
    const note = await this.store.updateNote(userId, noteId, sanitized);
    if (!note) {
      throw new WorkspaceError("NOTE_NOT_FOUND", "Note not found.", 404);
    }

    return note;
  }

  async deleteNote(userId: string, noteId: string) {
    ensureUuid(noteId, "INVALID_NOTE", "noteId must be a UUID.");
    const deleted = await this.store.deleteNote(userId, noteId);
    if (!deleted) {
      throw new WorkspaceError("NOTE_NOT_FOUND", "Note not found.", 404);
    }
  }

  async bulkDeleteNotes(userId: string, noteIds: unknown) {
    const normalizedNoteIds = sanitizeUuidList(noteIds, "INVALID_NOTE", "noteIds must contain UUID values.");
    return this.store.bulkDeleteNotes(userId, normalizedNoteIds);
  }

  async listSavedGraphs(userId: string, input: { limit?: number; cursor?: string }) {
    return this.store.listSavedGraphs(userId, sanitizeListLimit(input.limit), input.cursor);
  }

  async createSavedGraph(
    userId: string,
    input: { rootEntityId: string; title?: string; depth?: number; filters?: unknown; layoutPreference?: string | null },
  ) {
    ensureUuid(input.rootEntityId, "INVALID_GRAPH", "rootEntityId must be a UUID.");
    const depth = Number.isFinite(input.depth) ? Math.max(1, Math.min(10, Math.floor(input.depth as number))) : 3;
    const title = (input.title?.trim() || "Saved Graph").slice(0, 200);

    return this.store.createSavedGraph(userId, {
      rootEntityId: input.rootEntityId,
      title,
      depth,
      filters: input.filters ?? {},
      layoutPreference: input.layoutPreference?.trim() || null,
    });
  }

  async renameSavedGraph(userId: string, graphId: string, title: string) {
    ensureUuid(graphId, "INVALID_GRAPH", "graphId must be a UUID.");
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      throw new WorkspaceError("INVALID_GRAPH", "Graph title is required.");
    }

    const graph = await this.store.updateSavedGraphTitle(userId, graphId, normalizedTitle.slice(0, 200));
    if (!graph) {
      throw new WorkspaceError("RESOURCE_NOT_FOUND", "Saved graph not found.", 404);
    }

    return graph;
  }

  async deleteSavedGraph(userId: string, graphId: string) {
    ensureUuid(graphId, "INVALID_GRAPH", "graphId must be a UUID.");
    const deleted = await this.store.deleteSavedGraph(userId, graphId);
    if (!deleted) {
      throw new WorkspaceError("RESOURCE_NOT_FOUND", "Saved graph not found.", 404);
    }
  }

  async listHistory(userId: string, input: { limit?: number; cursor?: string }) {
    return this.store.listHistory(userId, sanitizeListLimit(input.limit), input.cursor);
  }

  async addHistory(userId: string, query: string) {
    const normalized = query.trim();
    if (!normalized) {
      throw new WorkspaceError("INVALID_HISTORY", "query is required.");
    }

    await this.store.addHistory(userId, normalized.slice(0, 200));
  }

  async clearHistory(userId: string) {
    await this.store.clearHistory(userId);
  }

  async listRecent(userId: string, limit?: number) {
    return this.store.listRecentViews(userId, sanitizeListLimit(limit));
  }

  async upsertRecent(userId: string, input: { entityType: string; entityId: string }) {
    ensureUuid(input.entityId, "INVALID_RECENT", "entityId must be a UUID.");
    const entityType = input.entityType.trim().toUpperCase();
    if (!entityType) {
      throw new WorkspaceError("INVALID_RECENT", "entityType is required.");
    }

    await this.store.upsertRecentView(userId, { entityType, entityId: input.entityId });
  }

  async getPreferences(userId: string) {
    return this.store.getPreferences(userId);
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
  ) {
    const nextPatch = { ...patch };
    if (patch.defaultGraphDepth !== undefined) {
      nextPatch.defaultGraphDepth = Math.max(1, Math.min(10, Math.floor(patch.defaultGraphDepth)));
    }
    if (patch.theme !== undefined) {
      nextPatch.theme = patch.theme.trim().slice(0, 30);
    }
    if (patch.interfaceLanguage !== undefined) {
      nextPatch.interfaceLanguage = patch.interfaceLanguage.trim().slice(0, 20);
    }
    if (patch.graphLayout !== undefined) {
      nextPatch.graphLayout = patch.graphLayout.trim().slice(0, 50);
    }

    return this.store.updatePreferences(userId, nextPatch);
  }

  async getSummary(userId: string) {
    return this.store.getSummary(userId);
  }

  async searchWorkspace(userId: string, input: { query: string; limit?: number }) {
    const query = String(input.query ?? "").trim();
    if (!query) {
      throw new WorkspaceError("INVALID_SEARCH", "query is required.");
    }

    const normalized = query.slice(0, MAX_WORKSPACE_SEARCH_QUERY_LENGTH);
    const limit = sanitizeListLimit(input.limit);
    return this.store.searchWorkspace(userId, normalized, limit);
  }

  async exportWorkspace(userId: string): Promise<WorkspaceExportPayload> {
    const [collections, savedWordsResult, savedGraphsResult, notesResult, preferences, memberships] = await Promise.all([
      this.store.listCollections(userId),
      this.store.listSavedWords(userId, MAX_LIST_LIMIT),
      this.store.listSavedGraphs(userId, MAX_LIST_LIMIT),
      this.store.listNotes(userId, MAX_LIST_LIMIT),
      this.store.getPreferences(userId),
      this.store.getCollectionMemberships(userId),
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      collections,
      savedWords: savedWordsResult.items.map((item) => ({
        ...item,
        collectionIds: memberships[item.id] ?? [],
      })),
      savedGraphs: savedGraphsResult.items,
      notes: notesResult.items,
      preferences,
    };
  }

  async importWorkspace(userId: string, payload: WorkspaceImportPayload) {
    if (!payload || typeof payload !== "object") {
      throw new WorkspaceError("IMPORT_INVALID", "Import payload must be an object.");
    }

    if (payload.version !== 1) {
      throw new WorkspaceError("IMPORT_INVALID", "Unsupported import schema version.");
    }

    if ((payload.collections?.length ?? 0) > MAX_IMPORT_COLLECTIONS) {
      throw new WorkspaceError("IMPORT_INVALID", `Import exceeds maximum collections (${MAX_IMPORT_COLLECTIONS}).`);
    }
    if ((payload.savedWords?.length ?? 0) > MAX_IMPORT_SAVED_WORDS) {
      throw new WorkspaceError("IMPORT_INVALID", `Import exceeds maximum saved words (${MAX_IMPORT_SAVED_WORDS}).`);
    }
    if ((payload.savedGraphs?.length ?? 0) > MAX_IMPORT_SAVED_GRAPHS) {
      throw new WorkspaceError("IMPORT_INVALID", `Import exceeds maximum saved graphs (${MAX_IMPORT_SAVED_GRAPHS}).`);
    }
    if ((payload.notes?.length ?? 0) > MAX_IMPORT_NOTES) {
      throw new WorkspaceError("IMPORT_INVALID", `Import exceeds maximum notes (${MAX_IMPORT_NOTES}).`);
    }

    const report = {
      importedWords: 0,
      importedCollections: 0,
      importedNotes: 0,
      importedGraphs: 0,
      skippedDuplicates: 0,
    };

    const existingCollections = await this.store.listCollections(userId);
    const collectionByName = new Map(existingCollections.map((collection) => [collection.name.toLowerCase(), collection]));

    for (const collectionInput of payload.collections ?? []) {
      const name = sanitizeCollectionName(collectionInput.name);
      const key = name.toLowerCase();
      if (collectionByName.has(key)) {
        report.skippedDuplicates += 1;
        continue;
      }

      const created = await this.store.createCollection(userId, {
        name,
        description: sanitizeCollectionDescription(collectionInput.description),
      });
      collectionByName.set(key, created);
      report.importedCollections += 1;
    }

    for (const savedWord of payload.savedWords ?? []) {
      try {
        ensureUuid(savedWord.wordId, "IMPORT_INVALID", "savedWords.wordId must be UUID.");
      } catch {
        report.skippedDuplicates += 1;
        continue;
      }
      const row = await this.store.saveWord(userId, savedWord.wordId);
      report.importedWords += 1;

      for (const name of savedWord.collectionNames ?? []) {
        const key = name.trim().toLowerCase();
        if (!key) {
          continue;
        }

        let collection = collectionByName.get(key);
        if (!collection) {
          collection = await this.store.createCollection(userId, { name: name.trim().slice(0, MAX_COLLECTION_NAME_LENGTH), description: null });
          collectionByName.set(key, collection);
          report.importedCollections += 1;
        }

        await this.store.addSavedWordToCollection(userId, row.id, collection.id);
      }
    }

    for (const graph of payload.savedGraphs ?? []) {
      try {
        ensureUuid(graph.rootEntityId, "IMPORT_INVALID", "savedGraphs.rootEntityId must be UUID.");
      } catch {
        report.skippedDuplicates += 1;
        continue;
      }

      await this.store.createSavedGraph(userId, {
        rootEntityId: graph.rootEntityId,
        title: (graph.title?.trim() || "Imported Graph").slice(0, 200),
        depth: Number.isFinite(graph.depth) ? Math.max(1, Math.min(10, Math.floor(graph.depth as number))) : 3,
        filters: graph.filters ?? {},
        layoutPreference: graph.layoutPreference ?? null,
      });
      report.importedGraphs += 1;
    }

    for (const note of payload.notes ?? []) {
      try {
        ensureUuid(note.targetId, "IMPORT_INVALID", "notes.targetId must be UUID.");
        const targetType = ensureTargetType(note.targetType);
        const content = sanitizeNoteContent(note.content);
        await this.store.createNote(userId, { targetType, targetId: note.targetId, content });
        report.importedNotes += 1;
      } catch {
        report.skippedDuplicates += 1;
      }
    }

    if (payload.preferences) {
      await this.updatePreferences(userId, payload.preferences);
    }

    return report;
  }
}
