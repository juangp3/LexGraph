import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { AuthOrchestrator } from "../../src/auth/auth.orchestrator.js";
import { WorkspaceOrchestrator } from "../../src/workspace/workspace.orchestrator.js";
import type { AuthSessionRecord, AuthStore, AuthStoreUser } from "../../src/auth/types.js";
import type {
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

class TestAuthStore implements AuthStore {
  users = new Map<string, AuthStoreUser>();
  byEmail = new Map<string, string>();
  sessions = new Map<string, AuthSessionRecord>();
  seq = 1;

  private id() {
    const base = String(this.seq++).padStart(12, "0");
    return `10000000-0000-4000-8000-${base}`;
  }

  async createUser(input: { email: string; passwordHash: string; displayName: string | null }): Promise<AuthStoreUser> {
    const now = new Date().toISOString();
    const user: AuthStoreUser = {
      id: this.id(),
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      avatarUrl: null,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
    this.users.set(user.id, user);
    this.byEmail.set(user.email, user.id);
    return user;
  }

  async findUserByEmail(email: string): Promise<AuthStoreUser | null> {
    const id = this.byEmail.get(email);
    return id ? (this.users.get(id) ?? null) : null;
  }

  async findUserById(userId: string): Promise<AuthStoreUser | null> {
    return this.users.get(userId) ?? null;
  }

  async createSession(input: { userId: string; tokenHash: string; userAgent: string | null; ipAddress: string | null; expiresAt: Date }): Promise<AuthSessionRecord> {
    const now = new Date().toISOString();
    const session: AuthSessionRecord = {
      id: this.id(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: input.expiresAt.toISOString(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionWithUserByTokenHash(tokenHash: string): Promise<{ session: AuthSessionRecord; user: AuthStoreUser } | null> {
    const session = [...this.sessions.values()].find((item) => item.tokenHash === tokenHash);
    if (!session) {
      return null;
    }
    const user = this.users.get(session.userId);
    if (!user) {
      return null;
    }
    return { session, user };
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      return;
    }

    this.users.set(userId, {
      ...user,
      status: "DELETED",
      email: `deleted+${userId}@deleted.local`,
      displayName: null,
      avatarUrl: null,
      passwordHash: "deleted",
      updatedAt: new Date().toISOString(),
    });

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
      }
    }
  }

  async updateLastLogin(userId: string, at: Date): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      return;
    }
    this.users.set(userId, { ...user, lastLoginAt: at.toISOString(), updatedAt: at.toISOString() });
  }
}

class TestWorkspaceStore implements WorkspaceStore {
  byUserSavedWords = new Map<string, SavedWord[]>();
  byUserCollections = new Map<string, WorkspaceCollection[]>();
  byUserNotes = new Map<string, WorkspaceNote[]>();
  byUserGraphs = new Map<string, SavedGraph[]>();
  byUserHistory = new Map<string, SearchHistoryItem[]>();
  byUserRecent = new Map<string, RecentViewItem[]>();
  byUserPrefs = new Map<string, WorkspacePreferences>();
  memberships = new Map<string, Record<string, string[]>>();
  seq = 1;

  private id() {
    const base = String(this.seq++).padStart(12, "0");
    return `20000000-0000-4000-8000-${base}`;
  }

  private now() { return new Date().toISOString(); }

  private list<T>(map: Map<string, T[]>, userId: string): T[] {
    if (!map.has(userId)) map.set(userId, []);
    return map.get(userId)!;
  }

  async listSavedWords(userId: string): Promise<{ items: SavedWord[]; nextCursor: string | null }> { return { items: [...this.list(this.byUserSavedWords, userId)], nextCursor: null }; }
  async saveWord(userId: string, wordId: string): Promise<SavedWord> {
    const rows = this.list(this.byUserSavedWords, userId);
    const existing = rows.find((row) => row.wordId === wordId);
    if (existing) return existing;
    const row: SavedWord = { id: this.id(), userId, wordId, textOriginal: "father", language: "English", stage: "Modern", createdAt: this.now(), updatedAt: this.now() };
    rows.unshift(row);
    return row;
  }
  async deleteSavedWord(userId: string, savedWordId: string): Promise<boolean> {
    const rows = this.list(this.byUserSavedWords, userId);
    const before = rows.length;
    this.byUserSavedWords.set(userId, rows.filter((row) => row.id !== savedWordId));
    return this.byUserSavedWords.get(userId)!.length < before;
  }
  async listBookmarks(userId: string): Promise<{ items: SavedWord[]; nextCursor: string | null }> { return this.listSavedWords(userId); }
  async saveBookmark(userId: string, wordId: string): Promise<SavedWord> { return this.saveWord(userId, wordId); }
  async deleteBookmark(userId: string, bookmarkId: string): Promise<boolean> { return this.deleteSavedWord(userId, bookmarkId); }
  async listCollections(userId: string): Promise<WorkspaceCollection[]> { return [...this.list(this.byUserCollections, userId)]; }
  async createCollection(userId: string, input: { name: string; description: string | null }): Promise<WorkspaceCollection> {
    const rows = this.list(this.byUserCollections, userId);
    const row: WorkspaceCollection = { id: this.id(), userId, name: input.name, description: input.description, position: rows.length, createdAt: this.now(), updatedAt: this.now() };
    rows.push(row);
    return row;
  }
  async updateCollection(userId: string, collectionId: string, input: { name?: string; description?: string | null; position?: number }): Promise<WorkspaceCollection | null> {
    const row = this.list(this.byUserCollections, userId).find((item) => item.id === collectionId);
    if (!row) return null;
    if (input.name !== undefined) row.name = input.name;
    if (input.description !== undefined) row.description = input.description;
    if (input.position !== undefined) row.position = input.position;
    row.updatedAt = this.now();
    return row;
  }
  async deleteCollection(userId: string, collectionId: string): Promise<boolean> {
    const rows = this.list(this.byUserCollections, userId);
    const before = rows.length;
    this.byUserCollections.set(userId, rows.filter((item) => item.id !== collectionId));
    return this.byUserCollections.get(userId)!.length < before;
  }
  async addSavedWordToCollection(userId: string, savedWordId: string, collectionId: string): Promise<boolean> {
    const hasWord = this.list(this.byUserSavedWords, userId).some((row) => row.id === savedWordId);
    const hasCollection = this.list(this.byUserCollections, userId).some((row) => row.id === collectionId);
    if (!hasWord || !hasCollection) return false;
    const map = this.memberships.get(userId) ?? {};
    const list = map[savedWordId] ?? [];
    if (!list.includes(collectionId)) list.push(collectionId);
    map[savedWordId] = list;
    this.memberships.set(userId, map);
    return true;
  }
  async removeSavedWordFromCollection(userId: string, savedWordId: string, collectionId: string): Promise<boolean> {
    const map = this.memberships.get(userId) ?? {};
    const memberships = map[savedWordId] ?? [];
    const next = memberships.filter((id) => id !== collectionId);
    const removed = next.length < memberships.length;
    map[savedWordId] = next;
    this.memberships.set(userId, map);
    return removed;
  }
  async bulkAddSavedWordsToCollection(userId: string, savedWordIds: string[], collectionId: string): Promise<{ added: number; notFound: number }> {
    const hasCollection = this.list(this.byUserCollections, userId).some((row) => row.id === collectionId);
    if (!hasCollection) {
      return { added: 0, notFound: savedWordIds.length };
    }
    let added = 0;
    let found = 0;
    for (const savedWordId of savedWordIds) {
      const hasWord = this.list(this.byUserSavedWords, userId).some((row) => row.id === savedWordId);
      if (!hasWord) {
        continue;
      }
      found += 1;
      const ok = await this.addSavedWordToCollection(userId, savedWordId, collectionId);
      if (ok) {
        added += 1;
      }
    }
    return { added, notFound: Math.max(0, savedWordIds.length - found) };
  }
  async bulkRemoveSavedWordsFromCollection(userId: string, savedWordIds: string[], collectionId: string): Promise<{ removed: number }> {
    let removed = 0;
    const map = this.memberships.get(userId) ?? {};
    for (const [savedWordId, collectionIds] of Object.entries(map)) {
      if (!savedWordIds.includes(savedWordId)) {
        continue;
      }
      const before = collectionIds.length;
      map[savedWordId] = collectionIds.filter((id) => id !== collectionId);
      if (map[savedWordId].length < before) {
        removed += 1;
      }
    }
    this.memberships.set(userId, map);
    return { removed };
  }
  async listNotes(userId: string): Promise<{ items: WorkspaceNote[]; nextCursor: string | null }> { return { items: [...this.list(this.byUserNotes, userId)], nextCursor: null }; }
  async createNote(userId: string, input: { targetType: "WORD" | "LANGUAGE" | "RELATIONSHIP" | "GRAPH" | "COLLECTION"; targetId: string; content: string }): Promise<WorkspaceNote> {
    const row: WorkspaceNote = { id: this.id(), userId, targetType: input.targetType, targetId: input.targetId, content: input.content, createdAt: this.now(), updatedAt: this.now() };
    this.list(this.byUserNotes, userId).unshift(row);
    return row;
  }
  async updateNote(userId: string, noteId: string, content: string): Promise<WorkspaceNote | null> {
    const row = this.list(this.byUserNotes, userId).find((item) => item.id === noteId);
    if (!row) return null;
    row.content = content;
    row.updatedAt = this.now();
    return row;
  }
  async deleteNote(userId: string, noteId: string): Promise<boolean> {
    const rows = this.list(this.byUserNotes, userId);
    const before = rows.length;
    this.byUserNotes.set(userId, rows.filter((item) => item.id !== noteId));
    return this.byUserNotes.get(userId)!.length < before;
  }
  async bulkDeleteNotes(userId: string, noteIds: string[]): Promise<{ deleted: number }> {
    const rows = this.list(this.byUserNotes, userId);
    const ids = new Set(noteIds);
    const before = rows.length;
    this.byUserNotes.set(userId, rows.filter((item) => !ids.has(item.id)));
    return { deleted: Math.max(0, before - this.byUserNotes.get(userId)!.length) };
  }
  async listSavedGraphs(userId: string): Promise<{ items: SavedGraph[]; nextCursor: string | null }> { return { items: [...this.list(this.byUserGraphs, userId)], nextCursor: null }; }
  async createSavedGraph(userId: string, input: { rootEntityId: string; title: string; depth: number; filters: unknown; layoutPreference: string | null }): Promise<SavedGraph> {
    const row: SavedGraph = { id: this.id(), userId, rootEntityId: input.rootEntityId, title: input.title, depth: input.depth, filters: input.filters, layoutPreference: input.layoutPreference, createdAt: this.now(), updatedAt: this.now() };
    this.list(this.byUserGraphs, userId).unshift(row);
    return row;
  }
  async updateSavedGraphTitle(userId: string, graphId: string, title: string): Promise<SavedGraph | null> {
    const row = this.list(this.byUserGraphs, userId).find((item) => item.id === graphId);
    if (!row) return null;
    row.title = title;
    return row;
  }
  async deleteSavedGraph(userId: string, graphId: string): Promise<boolean> {
    const rows = this.list(this.byUserGraphs, userId);
    const before = rows.length;
    this.byUserGraphs.set(userId, rows.filter((item) => item.id !== graphId));
    return this.byUserGraphs.get(userId)!.length < before;
  }
  async listHistory(userId: string): Promise<{ items: SearchHistoryItem[]; nextCursor: string | null }> { return { items: [...this.list(this.byUserHistory, userId)], nextCursor: null }; }
  async addHistory(userId: string, query: string): Promise<void> { this.list(this.byUserHistory, userId).unshift({ id: this.id(), userId, query, searchedAt: this.now() }); }
  async clearHistory(userId: string): Promise<void> { this.byUserHistory.set(userId, []); }
  async listRecentViews(userId: string): Promise<RecentViewItem[]> { return [...this.list(this.byUserRecent, userId)]; }
  async upsertRecentView(userId: string, input: { entityType: string; entityId: string }): Promise<void> { this.list(this.byUserRecent, userId).unshift({ userId, entityType: input.entityType, entityId: input.entityId, viewedAt: this.now() }); }
  async getPreferences(userId: string): Promise<WorkspacePreferences> {
    const existing = this.byUserPrefs.get(userId);
    if (existing) return existing;
    const created: WorkspacePreferences = { userId, theme: "system", interfaceLanguage: "en", defaultGraphDepth: 3, graphLayout: "hierarchical", showMeanings: true, showSources: true, updatedAt: this.now() };
    this.byUserPrefs.set(userId, created);
    return created;
  }
  async updatePreferences(userId: string, patch: Partial<Omit<WorkspacePreferences, "userId" | "updatedAt">>): Promise<WorkspacePreferences> {
    const current = await this.getPreferences(userId);
    const next = { ...current, ...patch, updatedAt: this.now() };
    this.byUserPrefs.set(userId, next);
    return next;
  }
  async getSummary(userId: string): Promise<WorkspaceSummary> {
    return { savedWords: this.list(this.byUserSavedWords, userId).length, savedGraphs: this.list(this.byUserGraphs, userId).length, collections: this.list(this.byUserCollections, userId).length, notes: this.list(this.byUserNotes, userId).length, recent: this.list(this.byUserRecent, userId).slice(0, 10) };
  }
  async getCollectionMemberships(userId: string): Promise<Record<string, string[]>> { return this.memberships.get(userId) ?? {}; }
  async searchWorkspace(userId: string, query: string, limit: number): Promise<WorkspaceSearchResult> {
    const q = query.toLowerCase();
    const words = this.list(this.byUserSavedWords, userId).filter((item) => item.textOriginal.toLowerCase().includes(q)).slice(0, limit);
    const collections = this.list(this.byUserCollections, userId)
      .filter((item) => item.name.toLowerCase().includes(q) || (item.description ?? "").toLowerCase().includes(q))
      .slice(0, limit);
    const notes = this.list(this.byUserNotes, userId).filter((item) => item.content.toLowerCase().includes(q)).slice(0, limit);
    const graphs = this.list(this.byUserGraphs, userId).filter((item) => item.title.toLowerCase().includes(q)).slice(0, limit);
    return { words, collections, notes, graphs };
  }
}

describe("workspace/auth api", () => {
  it("supports register/login and private /v1/me workspace access", async () => {
    const auth = new AuthOrchestrator(new TestAuthStore());
    const workspace = new WorkspaceOrchestrator(new TestWorkspaceStore());
    const app = createApp({ authOrchestrator: auth, workspaceOrchestrator: workspace });

    const register = await request(app)
      .post("/v1/auth/register")
      .send({ email: "api@example.com", password: "very-secret-password", displayName: "API User" })
      .expect(201);

    const token = register.body.session.accessToken as string;
    expect(token).toBeTruthy();

    const me = await request(app).get("/v1/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(me.body.email).toBe("api@example.com");

    const saveWord = await request(app)
      .post("/v1/me/saved-words")
      .set("Authorization", `Bearer ${token}`)
      .send({ wordId: "30000000-0000-4000-8000-000000000001" })
      .expect(200);

    expect(saveWord.body.wordId).toBe("30000000-0000-4000-8000-000000000001");

    const list = await request(app).get("/v1/me/saved-words").set("Authorization", `Bearer ${token}`).expect(200);
    expect(list.body.items).toHaveLength(1);

    const withoutToken = await request(app).get("/v1/me/saved-words").expect(401);
    expect(withoutToken.body.error.code).toBe("UNAUTHORIZED");
  });

  it("prevents user B from deleting user A saved word", async () => {
    const auth = new AuthOrchestrator(new TestAuthStore());
    const workspace = new WorkspaceOrchestrator(new TestWorkspaceStore());
    const app = createApp({ authOrchestrator: auth, workspaceOrchestrator: workspace });

    const registerA = await request(app)
      .post("/v1/auth/register")
      .send({ email: "user-a@example.com", password: "very-secret-password", displayName: "User A" })
      .expect(201);
    const tokenA = registerA.body.session.accessToken as string;

    const registerB = await request(app)
      .post("/v1/auth/register")
      .send({ email: "user-b@example.com", password: "very-secret-password", displayName: "User B" })
      .expect(201);
    const tokenB = registerB.body.session.accessToken as string;

    const saved = await request(app)
      .post("/v1/me/saved-words")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ wordId: "30000000-0000-4000-8000-000000000111" })
      .expect(200);

    await request(app)
      .delete(`/v1/me/saved-words/${saved.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
  });

  it("prevents user B from updating user A note", async () => {
    const auth = new AuthOrchestrator(new TestAuthStore());
    const workspace = new WorkspaceOrchestrator(new TestWorkspaceStore());
    const app = createApp({ authOrchestrator: auth, workspaceOrchestrator: workspace });

    const registerA = await request(app)
      .post("/v1/auth/register")
      .send({ email: "note-a@example.com", password: "very-secret-password", displayName: "User A" })
      .expect(201);
    const tokenA = registerA.body.session.accessToken as string;

    const registerB = await request(app)
      .post("/v1/auth/register")
      .send({ email: "note-b@example.com", password: "very-secret-password", displayName: "User B" })
      .expect(201);
    const tokenB = registerB.body.session.accessToken as string;

    const note = await request(app)
      .post("/v1/me/notes")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        targetType: "WORD",
        targetId: "30000000-0000-4000-8000-000000000211",
        content: "private note",
      })
      .expect(201);

    await request(app)
      .patch(`/v1/me/notes/${note.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ content: "intrusion" })
      .expect(404);
  });

  it("deletes account with password confirmation and revokes session", async () => {
    const auth = new AuthOrchestrator(new TestAuthStore());
    const workspace = new WorkspaceOrchestrator(new TestWorkspaceStore());
    const app = createApp({ authOrchestrator: auth, workspaceOrchestrator: workspace });

    const register = await request(app)
      .post("/v1/auth/register")
      .send({ email: "delete-flow@example.com", password: "very-secret-password", displayName: "Delete Me" })
      .expect(201);
    const token = register.body.session.accessToken as string;

    await request(app)
      .delete("/v1/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "wrong-password" })
      .expect(401);

    await request(app)
      .delete("/v1/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "very-secret-password" })
      .expect(204);

    await request(app)
      .get("/v1/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });

  it("supports workspace API contract for collections, notes, graphs, history, preferences, export, and import", async () => {
    const auth = new AuthOrchestrator(new TestAuthStore());
    const workspace = new WorkspaceOrchestrator(new TestWorkspaceStore());
    const app = createApp({ authOrchestrator: auth, workspaceOrchestrator: workspace });

    const register = await request(app)
      .post("/v1/auth/register")
      .send({ email: "contract@example.com", password: "very-secret-password", displayName: "Contract User" })
      .expect(201);
    const token = register.body.session.accessToken as string;

    const saved = await request(app)
      .post("/v1/me/saved-words")
      .set("Authorization", `Bearer ${token}`)
      .send({ wordId: "30000000-0000-4000-8000-000000000301" })
      .expect(200);

    const collection = await request(app)
      .post("/v1/me/collections")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Research", description: "PIE chain" })
      .expect(201);

    await request(app)
      .post(`/v1/me/collections/${collection.body.id}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ savedWordId: saved.body.id })
      .expect(204);

    const bookmark = await request(app)
      .post("/v1/me/bookmarks")
      .set("Authorization", `Bearer ${token}`)
      .send({ wordId: "30000000-0000-4000-8000-000000000301" })
      .expect(200);

    expect(bookmark.body.wordId).toBe("30000000-0000-4000-8000-000000000301");

    await request(app)
      .get("/v1/me/bookmarks")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app)
      .post(`/v1/me/collections/${collection.body.id}/items/bulk-add`)
      .set("Authorization", `Bearer ${token}`)
      .send({ savedWordIds: [saved.body.id] })
      .expect(200);

    await request(app)
      .patch(`/v1/me/collections/${collection.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Research Updated" })
      .expect(200);

    const note = await request(app)
      .post("/v1/me/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        targetType: "WORD",
        targetId: "30000000-0000-4000-8000-000000000302",
        content: "A note",
      })
      .expect(201);

    await request(app)
      .patch(`/v1/me/notes/${note.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Updated note" })
      .expect(200);

    await request(app)
      .post("/v1/me/notes/bulk-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ noteIds: [note.body.id] })
      .expect(200);

    const note2 = await request(app)
      .post("/v1/me/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        targetType: "WORD",
        targetId: "30000000-0000-4000-8000-000000000302",
        content: "A note",
      })
      .expect(201);

    const graph = await request(app)
      .post("/v1/me/saved-graphs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        rootEntityId: "30000000-0000-4000-8000-000000000303",
        title: "Father lineage",
        depth: 3,
        filters: { relationTypes: ["EVOLVED_FROM"] },
      })
      .expect(201);

    await request(app)
      .patch(`/v1/me/saved-graphs/${graph.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Father lineage updated" })
      .expect(200);

    await request(app)
      .post("/v1/me/history")
      .set("Authorization", `Bearer ${token}`)
      .send({ query: "father" })
      .expect(204);

    await request(app)
      .post("/v1/me/recent")
      .set("Authorization", `Bearer ${token}`)
      .send({ entityType: "WORD", entityId: "30000000-0000-4000-8000-000000000304" })
      .expect(204);

    const workspaceSearch = await request(app)
      .get("/v1/me/workspace-search")
      .set("Authorization", `Bearer ${token}`)
      .query({ q: "research" })
      .expect(200);

    expect(workspaceSearch.body.collections.length).toBeGreaterThanOrEqual(1);

    await request(app)
      .patch("/v1/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ defaultGraphDepth: 4, graphLayout: "radial" })
      .expect(200);

    const exported = await request(app)
      .get("/v1/me/export")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(exported.body.version).toBe(1);

    await request(app)
      .post("/v1/me/import")
      .set("Authorization", `Bearer ${token}`)
      .send({
        version: 1,
        collections: [{ name: "Imported Collection" }],
        savedWords: [{ wordId: "30000000-0000-4000-8000-000000000305", collectionNames: ["Imported Collection"] }],
      })
      .expect(200);

    await request(app)
      .delete(`/v1/me/saved-graphs/${graph.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    await request(app)
      .delete(`/v1/me/notes/${note.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(404);

    await request(app)
      .delete(`/v1/me/notes/${note2.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    await request(app)
      .post(`/v1/me/collections/${collection.body.id}/items/bulk-remove`)
      .set("Authorization", `Bearer ${token}`)
      .send({ savedWordIds: [saved.body.id] })
      .expect(200);

    await request(app)
      .delete(`/v1/me/bookmarks/${bookmark.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    await request(app)
      .delete(`/v1/me/collections/${collection.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
  });
});
