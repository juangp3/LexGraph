import { describe, expect, it } from "vitest";
import { WorkspaceError, WorkspaceOrchestrator } from "../../src/workspace/workspace.orchestrator.js";
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
} from "../../src/workspace/types.js";

class InMemoryWorkspaceStore implements WorkspaceStore {
  savedWords = new Map<string, SavedWord[]>();
  collections = new Map<string, WorkspaceCollection[]>();
  notes = new Map<string, WorkspaceNote[]>();
  graphs = new Map<string, SavedGraph[]>();
  history = new Map<string, SearchHistoryItem[]>();
  recent = new Map<string, RecentViewItem[]>();
  preferences = new Map<string, WorkspacePreferences>();
  memberships = new Map<string, Record<string, string[]>>();
  seq = 1;

  private id() {
    const base = String(this.seq++).padStart(12, "0");
    return `00000000-0000-4000-8000-${base}`;
  }

  private now() {
    return new Date().toISOString();
  }

  private list<T>(map: Map<string, T[]>, userId: string): T[] {
    if (!map.has(userId)) {
      map.set(userId, []);
    }
    return map.get(userId)!;
  }

  async listSavedWords(userId: string): Promise<{ items: SavedWord[]; nextCursor: string | null }> {
    return { items: [...this.list(this.savedWords, userId)], nextCursor: null };
  }

  async saveWord(userId: string, wordId: string): Promise<SavedWord> {
    const list = this.list(this.savedWords, userId);
    const existing = list.find((item) => item.wordId === wordId);
    if (existing) {
      existing.updatedAt = this.now();
      return existing;
    }

    const row: SavedWord = {
      id: this.id(),
      userId,
      wordId,
      textOriginal: "word",
      language: "English",
      stage: "Modern",
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    list.unshift(row);
    return row;
  }

  async deleteSavedWord(userId: string, savedWordId: string): Promise<boolean> {
    const list = this.list(this.savedWords, userId);
    const before = list.length;
    this.savedWords.set(userId, list.filter((item) => item.id !== savedWordId));
    return this.savedWords.get(userId)!.length < before;
  }

  async listBookmarks(userId: string): Promise<{ items: SavedWord[]; nextCursor: string | null }> {
    return this.listSavedWords(userId);
  }

  async saveBookmark(userId: string, wordId: string): Promise<SavedWord> {
    return this.saveWord(userId, wordId);
  }

  async deleteBookmark(userId: string, bookmarkId: string): Promise<boolean> {
    return this.deleteSavedWord(userId, bookmarkId);
  }

  async listCollections(userId: string): Promise<WorkspaceCollection[]> {
    return [...this.list(this.collections, userId)];
  }

  async createCollection(userId: string, input: { name: string; description: string | null }): Promise<WorkspaceCollection> {
    const list = this.list(this.collections, userId);
    const row: WorkspaceCollection = {
      id: this.id(),
      userId,
      name: input.name,
      description: input.description,
      position: list.length,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    list.push(row);
    return row;
  }

  async updateCollection(userId: string, collectionId: string, input: { name?: string; description?: string | null; position?: number }): Promise<WorkspaceCollection | null> {
    const list = this.list(this.collections, userId);
    const found = list.find((item) => item.id === collectionId);
    if (!found) {
      return null;
    }
    if (input.name !== undefined) found.name = input.name;
    if (input.description !== undefined) found.description = input.description;
    if (input.position !== undefined) found.position = input.position;
    found.updatedAt = this.now();
    return found;
  }

  async deleteCollection(userId: string, collectionId: string): Promise<boolean> {
    const list = this.list(this.collections, userId);
    const before = list.length;
    this.collections.set(userId, list.filter((item) => item.id !== collectionId));
    return this.collections.get(userId)!.length < before;
  }

  async addSavedWordToCollection(userId: string, savedWordId: string, collectionId: string): Promise<boolean> {
    const words = this.list(this.savedWords, userId);
    const collections = this.list(this.collections, userId);
    if (!words.some((word) => word.id === savedWordId) || !collections.some((collection) => collection.id === collectionId)) {
      return false;
    }
    const map = this.memberships.get(userId) ?? {};
    const list = map[savedWordId] ?? [];
    if (!list.includes(collectionId)) {
      list.push(collectionId);
      map[savedWordId] = list;
      this.memberships.set(userId, map);
    }
    return true;
  }

  async removeSavedWordFromCollection(userId: string, savedWordId: string, collectionId: string): Promise<boolean> {
    const map = this.memberships.get(userId) ?? {};
    const membership = map[savedWordId] ?? [];
    const next = membership.filter((id) => id !== collectionId);
    const removed = next.length < membership.length;
    map[savedWordId] = next;
    this.memberships.set(userId, map);
    return removed;
  }

  async bulkAddSavedWordsToCollection(userId: string, savedWordIds: string[], collectionId: string): Promise<{ added: number; notFound: number }> {
    const words = this.list(this.savedWords, userId);
    const collections = this.list(this.collections, userId);
    if (!collections.some((collection) => collection.id === collectionId)) {
      return { added: 0, notFound: savedWordIds.length };
    }

    let added = 0;
    let found = 0;
    for (const savedWordId of savedWordIds) {
      const hasWord = words.some((word) => word.id === savedWordId);
      if (!hasWord) {
        continue;
      }
      found += 1;
      const linked = await this.addSavedWordToCollection(userId, savedWordId, collectionId);
      if (linked) {
        added += 1;
      }
    }

    return { added, notFound: Math.max(0, savedWordIds.length - found) };
  }

  async bulkRemoveSavedWordsFromCollection(userId: string, savedWordIds: string[], collectionId: string): Promise<{ removed: number }> {
    let removed = 0;
    for (const savedWordId of savedWordIds) {
      const ok = await this.removeSavedWordFromCollection(userId, savedWordId, collectionId);
      if (ok) {
        removed += 1;
      }
    }
    return { removed };
  }

  async listNotes(userId: string): Promise<{ items: WorkspaceNote[]; nextCursor: string | null }> {
    return { items: [...this.list(this.notes, userId)], nextCursor: null };
  }

  async createNote(userId: string, input: { targetType: NoteTargetType; targetId: string; content: string }): Promise<WorkspaceNote> {
    const list = this.list(this.notes, userId);
    const row: WorkspaceNote = {
      id: this.id(),
      userId,
      targetType: input.targetType,
      targetId: input.targetId,
      content: input.content,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    list.unshift(row);
    return row;
  }

  async updateNote(userId: string, noteId: string, content: string): Promise<WorkspaceNote | null> {
    const list = this.list(this.notes, userId);
    const found = list.find((item) => item.id === noteId);
    if (!found) {
      return null;
    }
    found.content = content;
    found.updatedAt = this.now();
    return found;
  }

  async deleteNote(userId: string, noteId: string): Promise<boolean> {
    const list = this.list(this.notes, userId);
    const before = list.length;
    this.notes.set(userId, list.filter((item) => item.id !== noteId));
    return this.notes.get(userId)!.length < before;
  }

  async bulkDeleteNotes(userId: string, noteIds: string[]): Promise<{ deleted: number }> {
    const list = this.list(this.notes, userId);
    const ids = new Set(noteIds);
    const before = list.length;
    this.notes.set(userId, list.filter((item) => !ids.has(item.id)));
    return { deleted: Math.max(0, before - this.notes.get(userId)!.length) };
  }

  async listSavedGraphs(userId: string): Promise<{ items: SavedGraph[]; nextCursor: string | null }> {
    return { items: [...this.list(this.graphs, userId)], nextCursor: null };
  }

  async createSavedGraph(userId: string, input: { rootEntityId: string; title: string; depth: number; filters: unknown; layoutPreference: string | null }): Promise<SavedGraph> {
    const list = this.list(this.graphs, userId);
    const row: SavedGraph = {
      id: this.id(),
      userId,
      rootEntityId: input.rootEntityId,
      title: input.title,
      depth: input.depth,
      filters: input.filters,
      layoutPreference: input.layoutPreference,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    list.unshift(row);
    return row;
  }

  async updateSavedGraphTitle(userId: string, graphId: string, title: string): Promise<SavedGraph | null> {
    const list = this.list(this.graphs, userId);
    const found = list.find((item) => item.id === graphId);
    if (!found) return null;
    found.title = title;
    found.updatedAt = this.now();
    return found;
  }

  async deleteSavedGraph(userId: string, graphId: string): Promise<boolean> {
    const list = this.list(this.graphs, userId);
    const before = list.length;
    this.graphs.set(userId, list.filter((item) => item.id !== graphId));
    return this.graphs.get(userId)!.length < before;
  }

  async listHistory(userId: string): Promise<{ items: SearchHistoryItem[]; nextCursor: string | null }> {
    return { items: [...this.list(this.history, userId)], nextCursor: null };
  }

  async addHistory(userId: string, query: string): Promise<void> {
    const list = this.list(this.history, userId);
    list.unshift({ id: this.id(), userId, query, searchedAt: this.now() });
  }

  async clearHistory(userId: string): Promise<void> {
    this.history.set(userId, []);
  }

  async listRecentViews(userId: string): Promise<RecentViewItem[]> {
    return [...this.list(this.recent, userId)];
  }

  async upsertRecentView(userId: string, input: { entityType: string; entityId: string }): Promise<void> {
    const list = this.list(this.recent, userId);
    const existing = list.find((row) => row.entityType === input.entityType && row.entityId === input.entityId);
    if (existing) {
      existing.viewedAt = this.now();
      return;
    }
    list.unshift({ userId, entityType: input.entityType, entityId: input.entityId, viewedAt: this.now() });
  }

  async getPreferences(userId: string): Promise<WorkspacePreferences> {
    const existing = this.preferences.get(userId);
    if (existing) return existing;
    const created: WorkspacePreferences = {
      userId,
      theme: "system",
      interfaceLanguage: "en",
      defaultGraphDepth: 3,
      graphLayout: "hierarchical",
      showMeanings: true,
      showSources: true,
      updatedAt: this.now(),
    };
    this.preferences.set(userId, created);
    return created;
  }

  async updatePreferences(userId: string, patch: Partial<Omit<WorkspacePreferences, "userId" | "updatedAt">>): Promise<WorkspacePreferences> {
    const current = await this.getPreferences(userId);
    const updated = {
      ...current,
      ...patch,
      updatedAt: this.now(),
    };
    this.preferences.set(userId, updated);
    return updated;
  }

  async getSummary(userId: string): Promise<WorkspaceSummary> {
    return {
      savedWords: this.list(this.savedWords, userId).length,
      savedGraphs: this.list(this.graphs, userId).length,
      collections: this.list(this.collections, userId).length,
      notes: this.list(this.notes, userId).length,
      recent: this.list(this.recent, userId).slice(0, 10),
    };
  }

  async getCollectionMemberships(userId: string): Promise<Record<string, string[]>> {
    return this.memberships.get(userId) ?? {};
  }

  async searchWorkspace(userId: string, query: string, limit: number): Promise<WorkspaceSearchResult> {
    const q = query.toLowerCase();
    const words = this.list(this.savedWords, userId).filter((item) => item.textOriginal.toLowerCase().includes(q)).slice(0, limit);
    const collections = this.list(this.collections, userId)
      .filter((item) => item.name.toLowerCase().includes(q) || (item.description ?? "").toLowerCase().includes(q))
      .slice(0, limit);
    const notes = this.list(this.notes, userId).filter((item) => item.content.toLowerCase().includes(q)).slice(0, limit);
    const graphs = this.list(this.graphs, userId).filter((item) => item.title.toLowerCase().includes(q)).slice(0, limit);
    return { words, collections, notes, graphs };
  }
}

describe("WorkspaceOrchestrator", () => {
  it("prevents duplicate save via idempotent store behavior", async () => {
    const store = new InMemoryWorkspaceStore();
    const workspace = new WorkspaceOrchestrator(store);
    const userId = "00000000-0000-4000-8000-000000000001";
    const wordId = "00000000-0000-4000-8000-000000000002";

    await workspace.saveWord(userId, wordId);
    await workspace.saveWord(userId, wordId);

    const saved = await workspace.listSavedWords(userId, { limit: 20 });
    expect(saved.items).toHaveLength(1);
  });

  it("creates and updates collections with validation", async () => {
    const store = new InMemoryWorkspaceStore();
    const workspace = new WorkspaceOrchestrator(store);
    const userId = "00000000-0000-4000-8000-000000000010";

    const collection = await workspace.createCollection(userId, { name: "Research", description: "Indo-European" });
    const updated = await workspace.updateCollection(userId, collection.id, { name: "Research v2" });

    expect(updated.name).toBe("Research v2");
  });

  it("rejects invalid note target and content", async () => {
    const store = new InMemoryWorkspaceStore();
    const workspace = new WorkspaceOrchestrator(store);
    const userId = "00000000-0000-4000-8000-000000000020";

    await expect(
      workspace.createNote(userId, {
        targetType: "invalid",
        targetId: "00000000-0000-4000-8000-000000000021",
        content: "content",
      }),
    ).rejects.toBeInstanceOf(WorkspaceError);

    await expect(
      workspace.createNote(userId, {
        targetType: "WORD",
        targetId: "00000000-0000-4000-8000-000000000021",
        content: "   ",
      }),
    ).rejects.toBeInstanceOf(WorkspaceError);
  });

  it("exports and imports workspace payload", async () => {
    const store = new InMemoryWorkspaceStore();
    const workspace = new WorkspaceOrchestrator(store);
    const userId = "00000000-0000-4000-8000-000000000030";
    const wordId = "00000000-0000-4000-8000-000000000031";

    await workspace.createCollection(userId, { name: "Linguistics", description: null });
    await workspace.saveWord(userId, wordId);

    const exported = await workspace.exportWorkspace(userId);
    expect(exported.version).toBe(1);
    expect(exported.savedWords.length).toBe(1);

    const imported = await workspace.importWorkspace("00000000-0000-4000-8000-000000000040", {
      version: 1,
      collections: [{ name: "Linguistics" }],
      savedWords: [{ wordId, collectionNames: ["Linguistics"] }],
    });

    expect(imported.importedWords).toBe(1);
    expect(imported.importedCollections).toBe(1);
  });
});
