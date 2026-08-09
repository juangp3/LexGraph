import { http, HttpResponse } from "msw";

const WORD_IDS = {
  father: "d694f27c-633c-44a9-a881-130b223b1120",
  mother: "fca87886-e8f8-47e2-9baa-329c2f79ff47",
  daughter: "1f4c2db8-7cdd-4a52-9a7f-a4d4a22bde17",
  pieFather: "6f49fc8d-c95e-425b-8bde-4f9682a41acd",
  pgFather: "37e7f503-a5ca-43e7-ba7b-09a458c1de95",
  oeFather: "f1a49ab9-fbbe-4d16-b693-3af0a4a17e00",
  oldNorse: "8d0f8c4c-01d3-4e94-8a1f-df8a30260b49",
} as const;

const wordDetailsById: Record<string, { textOriginal: string; language: string; stage?: string }> = {
  [WORD_IDS.father]: { textOriginal: "father", language: "English", stage: "Modern English" },
  [WORD_IDS.mother]: { textOriginal: "mother", language: "English", stage: "Modern English" },
  [WORD_IDS.daughter]: { textOriginal: "daughter", language: "English", stage: "Modern English" },
  [WORD_IDS.pieFather]: { textOriginal: "*ph2ter", language: "Proto-Indo-European", stage: "Proto" },
  [WORD_IDS.pgFather]: { textOriginal: "*fader", language: "Proto-Germanic", stage: "Proto" },
  [WORD_IDS.oeFather]: { textOriginal: "faeder", language: "Old English", stage: "Old English" },
  [WORD_IDS.oldNorse]: { textOriginal: "fathir", language: "Old Norse", stage: "Old Norse" },
};

interface MockUser {
  id: string;
  email: string;
  password: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface MockCollection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface MockSavedWord {
  id: string;
  userId: string;
  wordId: string;
  textOriginal: string;
  language: string | null;
  stage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MockNote {
  id: string;
  userId: string;
  targetType: "WORD" | "LANGUAGE" | "RELATIONSHIP" | "GRAPH" | "COLLECTION";
  targetId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface MockSavedGraph {
  id: string;
  userId: string;
  rootEntityId: string;
  title: string;
  depth: number;
  filters: unknown;
  layoutPreference: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MockPreference {
  userId: string;
  theme: string;
  interfaceLanguage: string;
  defaultGraphDepth: number;
  graphLayout: string;
  showMeanings: boolean;
  showSources: boolean;
  updatedAt: string;
}

interface MockHistory {
  id: string;
  userId: string;
  query: string;
  searchedAt: string;
}

interface MockRecent {
  userId: string;
  entityType: string;
  entityId: string;
  viewedAt: string;
}

const usersByEmail = new Map<string, MockUser>();
const usersById = new Map<string, MockUser>();
const tokensToUserId = new Map<string, string>();
const savedWordsByUser = new Map<string, MockSavedWord[]>();
const collectionsByUser = new Map<string, MockCollection[]>();
const collectionMembershipByUser = new Map<string, Record<string, string[]>>();
const notesByUser = new Map<string, MockNote[]>();
const savedGraphsByUser = new Map<string, MockSavedGraph[]>();
const preferencesByUser = new Map<string, MockPreference>();
const historyByUser = new Map<string, MockHistory[]>();
const recentByUser = new Map<string, MockRecent[]>();
let idCounter = 1;

function nextId(): string {
  return `90000000-0000-4000-8000-${String(idCounter++).padStart(12, "0")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getAuthToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  return token;
}

function getUserFromRequest(request: Request): MockUser | null {
  const token = getAuthToken(request);
  if (!token) {
    return null;
  }

  const userId = tokensToUserId.get(token);
  if (!userId) {
    return null;
  }

  return usersById.get(userId) ?? null;
}

function ensureList<T>(map: Map<string, T[]>, userId: string): T[] {
  if (!map.has(userId)) {
    map.set(userId, []);
  }
  return map.get(userId)!;
}

function ensurePreference(userId: string): MockPreference {
  let preference = preferencesByUser.get(userId);
  if (!preference) {
    preference = {
      userId,
      theme: "system",
      interfaceLanguage: "en",
      defaultGraphDepth: 3,
      graphLayout: "hierarchical",
      showMeanings: true,
      showSources: true,
      updatedAt: nowIso(),
    };
    preferencesByUser.set(userId, preference);
  }
  return preference;
}

function unauthorized() {
  return HttpResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401 });
}

function upsertRecent(userId: string, entityType: string, entityId: string) {
  const list = ensureList(recentByUser, userId);
  const existing = list.find((item) => item.entityType === entityType && item.entityId === entityId);
  if (existing) {
    existing.viewedAt = nowIso();
    return;
  }
  list.unshift({ userId, entityType, entityId, viewedAt: nowIso() });
  if (list.length > 100) {
    list.splice(100);
  }
}

function toSummary(userId: string) {
  return {
    savedWords: ensureList(savedWordsByUser, userId).length,
    savedGraphs: ensureList(savedGraphsByUser, userId).length,
    collections: ensureList(collectionsByUser, userId).length,
    notes: ensureList(notesByUser, userId).length,
    recent: ensureList(recentByUser, userId).slice(0, 10),
  };
}

export const handlers = [
  http.post("http://localhost:3001/v1/auth/register", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string; displayName?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) {
      return HttpResponse.json({ error: { code: "INVALID_REQUEST", message: "Email and password are required." } }, { status: 400 });
    }
    if (usersByEmail.has(email)) {
      return HttpResponse.json({ error: { code: "EMAIL_ALREADY_EXISTS", message: "An account with this email already exists." } }, { status: 409 });
    }

    const now = nowIso();
    const user: MockUser = {
      id: nextId(),
      email,
      password,
      displayName: body.displayName?.trim() || null,
      avatarUrl: null,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };

    usersByEmail.set(email, user);
    usersById.set(user.id, user);
    ensurePreference(user.id);

    const token = `mock-token-${user.id}-${Date.now()}`;
    tokensToUserId.set(token, user.id);

    return HttpResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
      session: {
        accessToken: token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      },
    }, { status: 201 });
  }),

  http.post("http://localhost:3001/v1/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const user = usersByEmail.get(email);
    if (!user || user.password !== password || user.status !== "ACTIVE") {
      return HttpResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials." } }, { status: 401 });
    }

    user.lastLoginAt = nowIso();
    user.updatedAt = nowIso();

    const token = `mock-token-${user.id}-${Date.now()}`;
    tokensToUserId.set(token, user.id);

    return HttpResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
      session: {
        accessToken: token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      },
    });
  }),

  http.post("http://localhost:3001/v1/auth/logout", async ({ request }) => {
    const token = getAuthToken(request);
    if (token) {
      tokensToUserId.delete(token);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("http://localhost:3001/v1/me", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    return HttpResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    });
  }),

  http.delete("http://localhost:3001/v1/me", async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const body = (await request.json()) as { password?: string };
    if (String(body.password ?? "") !== user.password) {
      return HttpResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials." } }, { status: 401 });
    }

    user.status = "DELETED";
    user.email = `deleted+${user.id}@deleted.local`;
    user.displayName = null;
    user.updatedAt = nowIso();

    for (const [token, userId] of tokensToUserId.entries()) {
      if (userId === user.id) {
        tokensToUserId.delete(token);
      }
    }

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("http://localhost:3001/v1/me/workspace-summary", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }
    return HttpResponse.json(toSummary(user.id));
  }),

  http.get("http://localhost:3001/v1/me/saved-words", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }
    return HttpResponse.json({ items: ensureList(savedWordsByUser, user.id), nextCursor: null });
  }),

  http.post("http://localhost:3001/v1/me/saved-words", async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const body = (await request.json()) as { wordId?: string };
    const wordId = String(body.wordId ?? "");
    if (!wordId) {
      return HttpResponse.json({ error: { code: "INVALID_WORD_ID", message: "wordId required." } }, { status: 400 });
    }

    const list = ensureList(savedWordsByUser, user.id);
    const existing = list.find((item) => item.wordId === wordId);
    if (existing) {
      existing.updatedAt = nowIso();
      return HttpResponse.json(existing);
    }

    const details = wordDetailsById[wordId];
    const row: MockSavedWord = {
      id: nextId(),
      userId: user.id,
      wordId,
      textOriginal: details?.textOriginal ?? wordId,
      language: details?.language ?? null,
      stage: details?.stage ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    list.unshift(row);
    return HttpResponse.json(row);
  }),

  http.delete("http://localhost:3001/v1/me/saved-words/:savedWordId", ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const savedWordId = String(params.savedWordId);
    const list = ensureList(savedWordsByUser, user.id);
    const next = list.filter((item) => item.id !== savedWordId);
    if (next.length === list.length) {
      return HttpResponse.json({ error: { code: "RESOURCE_NOT_FOUND", message: "Saved word not found." } }, { status: 404 });
    }
    savedWordsByUser.set(user.id, next);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("http://localhost:3001/v1/me/bookmarks", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }
    return HttpResponse.json({ items: ensureList(savedWordsByUser, user.id), nextCursor: null });
  }),

  http.post("http://localhost:3001/v1/me/bookmarks", async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const body = (await request.json()) as { wordId?: string };
    const wordId = String(body.wordId ?? "");
    if (!wordId) {
      return HttpResponse.json({ error: { code: "INVALID_WORD_ID", message: "wordId required." } }, { status: 400 });
    }

    const list = ensureList(savedWordsByUser, user.id);
    const existing = list.find((item) => item.wordId === wordId);
    if (existing) {
      existing.updatedAt = nowIso();
      return HttpResponse.json(existing);
    }

    const details = wordDetailsById[wordId];
    const row: MockSavedWord = {
      id: nextId(),
      userId: user.id,
      wordId,
      textOriginal: details?.textOriginal ?? wordId,
      language: details?.language ?? null,
      stage: details?.stage ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    list.unshift(row);
    return HttpResponse.json(row);
  }),

  http.delete("http://localhost:3001/v1/me/bookmarks/:bookmarkId", ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const bookmarkId = String(params.bookmarkId);
    const list = ensureList(savedWordsByUser, user.id);
    const next = list.filter((item) => item.id !== bookmarkId);
    if (next.length === list.length) {
      return HttpResponse.json({ error: { code: "RESOURCE_NOT_FOUND", message: "Bookmark not found." } }, { status: 404 });
    }
    savedWordsByUser.set(user.id, next);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("http://localhost:3001/v1/me/collections", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }
    return HttpResponse.json(ensureList(collectionsByUser, user.id));
  }),

  http.post("http://localhost:3001/v1/me/collections", async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const body = (await request.json()) as { name?: string; description?: string | null };
    const name = String(body.name ?? "").trim();
    if (!name) {
      return HttpResponse.json({ error: { code: "INVALID_COLLECTION", message: "Collection name is required." } }, { status: 400 });
    }

    const list = ensureList(collectionsByUser, user.id);
    const row: MockCollection = {
      id: nextId(),
      userId: user.id,
      name,
      description: body.description ?? null,
      position: list.length,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    list.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),

  http.patch("http://localhost:3001/v1/me/collections/:collectionId", async ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const collectionId = String(params.collectionId);
    const body = (await request.json()) as { name?: string; description?: string | null; position?: number };
    const list = ensureList(collectionsByUser, user.id);
    const target = list.find((item) => item.id === collectionId);
    if (!target) {
      return HttpResponse.json({ error: { code: "COLLECTION_NOT_FOUND", message: "Collection not found." } }, { status: 404 });
    }

    if (typeof body.name === "string") {
      target.name = body.name;
    }
    if (body.description === null || typeof body.description === "string") {
      target.description = body.description;
    }
    if (typeof body.position === "number") {
      target.position = Math.max(0, Math.floor(body.position));
    }
    target.updatedAt = nowIso();
    return HttpResponse.json(target);
  }),

  http.delete("http://localhost:3001/v1/me/collections/:collectionId", ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const collectionId = String(params.collectionId);
    const list = ensureList(collectionsByUser, user.id);
    const next = list.filter((item) => item.id !== collectionId);
    if (next.length === list.length) {
      return HttpResponse.json({ error: { code: "COLLECTION_NOT_FOUND", message: "Collection not found." } }, { status: 404 });
    }
    collectionsByUser.set(user.id, next);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("http://localhost:3001/v1/me/collections/:collectionId/items", async ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const body = (await request.json()) as { savedWordId?: string };
    const collectionId = String(params.collectionId);
    const savedWordId = String(body.savedWordId ?? "");

    const collections = ensureList(collectionsByUser, user.id);
    const words = ensureList(savedWordsByUser, user.id);
    if (!collections.some((item) => item.id === collectionId) || !words.some((item) => item.id === savedWordId)) {
      return HttpResponse.json({ error: { code: "RESOURCE_NOT_FOUND", message: "Saved word or collection not found." } }, { status: 404 });
    }

    const map = collectionMembershipByUser.get(user.id) ?? {};
    const memberships = map[savedWordId] ?? [];
    if (!memberships.includes(collectionId)) {
      memberships.push(collectionId);
    }
    map[savedWordId] = memberships;
    collectionMembershipByUser.set(user.id, map);

    return new HttpResponse(null, { status: 204 });
  }),

  http.post("http://localhost:3001/v1/me/collections/:collectionId/items/bulk-add", async ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const body = (await request.json()) as { savedWordIds?: string[] };
    const collectionId = String(params.collectionId);
    const input = Array.isArray(body.savedWordIds) ? body.savedWordIds.map((value) => String(value)) : [];

    const collections = ensureList(collectionsByUser, user.id);
    if (!collections.some((item) => item.id === collectionId)) {
      return HttpResponse.json({ added: 0, notFound: input.length });
    }

    const words = ensureList(savedWordsByUser, user.id);
    const existingWordIds = new Set(words.map((item) => item.id));
    const map = collectionMembershipByUser.get(user.id) ?? {};
    let added = 0;
    let found = 0;

    for (const savedWordId of input) {
      if (!existingWordIds.has(savedWordId)) {
        continue;
      }
      found += 1;
      const memberships = map[savedWordId] ?? [];
      if (!memberships.includes(collectionId)) {
        memberships.push(collectionId);
        map[savedWordId] = memberships;
        added += 1;
      }
    }

    collectionMembershipByUser.set(user.id, map);
    return HttpResponse.json({ added, notFound: Math.max(0, input.length - found) });
  }),

  http.post("http://localhost:3001/v1/me/collections/:collectionId/items/bulk-remove", async ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const body = (await request.json()) as { savedWordIds?: string[] };
    const collectionId = String(params.collectionId);
    const input = Array.isArray(body.savedWordIds) ? body.savedWordIds.map((value) => String(value)) : [];
    const map = collectionMembershipByUser.get(user.id) ?? {};
    let removed = 0;

    for (const savedWordId of input) {
      const memberships = map[savedWordId] ?? [];
      const next = memberships.filter((id) => id !== collectionId);
      if (next.length < memberships.length) {
        removed += 1;
        map[savedWordId] = next;
      }
    }

    collectionMembershipByUser.set(user.id, map);
    return HttpResponse.json({ removed });
  }),

  http.get("http://localhost:3001/v1/me/notes", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    return HttpResponse.json({ items: ensureList(notesByUser, user.id), nextCursor: null });
  }),

  http.post("http://localhost:3001/v1/me/notes", async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const body = (await request.json()) as { targetType?: MockNote["targetType"]; targetId?: string; content?: string };
    const targetId = String(body.targetId ?? "");
    const content = String(body.content ?? "").trim();
    if (!targetId || !content) {
      return HttpResponse.json({ error: { code: "INVALID_NOTE", message: "targetId and content are required." } }, { status: 400 });
    }

    const row: MockNote = {
      id: nextId(),
      userId: user.id,
      targetType: body.targetType ?? "WORD",
      targetId,
      content,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    ensureList(notesByUser, user.id).unshift(row);
    return HttpResponse.json(row, { status: 201 });
  }),

  http.patch("http://localhost:3001/v1/me/notes/:noteId", async ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const noteId = String(params.noteId);
    const body = (await request.json()) as { content?: string };
    const list = ensureList(notesByUser, user.id);
    const note = list.find((item) => item.id === noteId);
    if (!note) {
      return HttpResponse.json({ error: { code: "NOTE_NOT_FOUND", message: "Note not found." } }, { status: 404 });
    }
    note.content = String(body.content ?? note.content);
    note.updatedAt = nowIso();
    return HttpResponse.json(note);
  }),

  http.delete("http://localhost:3001/v1/me/notes/:noteId", ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const noteId = String(params.noteId);
    const list = ensureList(notesByUser, user.id);
    const next = list.filter((item) => item.id !== noteId);
    if (next.length === list.length) {
      return HttpResponse.json({ error: { code: "NOTE_NOT_FOUND", message: "Note not found." } }, { status: 404 });
    }
    notesByUser.set(user.id, next);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("http://localhost:3001/v1/me/notes/bulk-delete", async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const body = (await request.json()) as { noteIds?: string[] };
    const noteIds = new Set((Array.isArray(body.noteIds) ? body.noteIds : []).map((value) => String(value)));
    const list = ensureList(notesByUser, user.id);
    const before = list.length;
    notesByUser.set(user.id, list.filter((item) => !noteIds.has(item.id)));
    return HttpResponse.json({ deleted: Math.max(0, before - ensureList(notesByUser, user.id).length) });
  }),

  http.get("http://localhost:3001/v1/me/saved-graphs", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }
    return HttpResponse.json({ items: ensureList(savedGraphsByUser, user.id), nextCursor: null });
  }),

  http.post("http://localhost:3001/v1/me/saved-graphs", async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const body = (await request.json()) as { rootEntityId?: string; title?: string; depth?: number; filters?: unknown; layoutPreference?: string | null };
    const rootEntityId = String(body.rootEntityId ?? "");
    if (!rootEntityId) {
      return HttpResponse.json({ error: { code: "INVALID_GRAPH", message: "rootEntityId is required." } }, { status: 400 });
    }

    const row: MockSavedGraph = {
      id: nextId(),
      userId: user.id,
      rootEntityId,
      title: String(body.title ?? "Saved Graph"),
      depth: Number(body.depth ?? 3),
      filters: body.filters ?? {},
      layoutPreference: body.layoutPreference ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    ensureList(savedGraphsByUser, user.id).unshift(row);
    return HttpResponse.json(row, { status: 201 });
  }),

  http.patch("http://localhost:3001/v1/me/saved-graphs/:graphId", async ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const graphId = String(params.graphId);
    const body = (await request.json()) as { title?: string };
    const list = ensureList(savedGraphsByUser, user.id);
    const graph = list.find((item) => item.id === graphId);
    if (!graph) {
      return HttpResponse.json({ error: { code: "RESOURCE_NOT_FOUND", message: "Saved graph not found." } }, { status: 404 });
    }
    graph.title = String(body.title ?? graph.title);
    graph.updatedAt = nowIso();
    return HttpResponse.json(graph);
  }),

  http.delete("http://localhost:3001/v1/me/saved-graphs/:graphId", ({ request, params }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const graphId = String(params.graphId);
    const list = ensureList(savedGraphsByUser, user.id);
    const next = list.filter((item) => item.id !== graphId);
    if (next.length === list.length) {
      return HttpResponse.json({ error: { code: "RESOURCE_NOT_FOUND", message: "Saved graph not found." } }, { status: 404 });
    }
    savedGraphsByUser.set(user.id, next);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("http://localhost:3001/v1/me/history", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }
    return HttpResponse.json({ items: ensureList(historyByUser, user.id), nextCursor: null });
  }),

  http.post("http://localhost:3001/v1/me/history", async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }
    const body = (await request.json()) as { query?: string };
    const query = String(body.query ?? "").trim();
    if (!query) {
      return HttpResponse.json({ error: { code: "INVALID_HISTORY", message: "query is required." } }, { status: 400 });
    }

    const list = ensureList(historyByUser, user.id);
    list.unshift({ id: nextId(), userId: user.id, query, searchedAt: nowIso() });
    if (list.length > 500) {
      list.splice(500);
    }

    return new HttpResponse(null, { status: 204 });
  }),

  http.delete("http://localhost:3001/v1/me/history", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }
    historyByUser.set(user.id, []);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("http://localhost:3001/v1/me/recent", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }
    return HttpResponse.json(ensureList(recentByUser, user.id));
  }),

  http.post("http://localhost:3001/v1/me/recent", async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const body = (await request.json()) as { entityType?: string; entityId?: string };
    const entityType = String(body.entityType ?? "").toUpperCase();
    const entityId = String(body.entityId ?? "");
    if (!entityType || !entityId) {
      return HttpResponse.json({ error: { code: "INVALID_RECENT", message: "entityType and entityId are required." } }, { status: 400 });
    }

    upsertRecent(user.id, entityType, entityId);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("http://localhost:3001/v1/me/preferences", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    return HttpResponse.json(ensurePreference(user.id));
  }),

  http.patch("http://localhost:3001/v1/me/preferences", async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const body = (await request.json()) as Partial<MockPreference>;
    const current = ensurePreference(user.id);
    const next: MockPreference = {
      ...current,
      ...body,
      userId: user.id,
      updatedAt: nowIso(),
    };
    preferencesByUser.set(user.id, next);
    return HttpResponse.json(next);
  }),

  http.get("http://localhost:3001/v1/me/workspace-search", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").toLowerCase().trim();
    const limit = Math.max(1, Number(url.searchParams.get("limit") ?? 20));

    const words = ensureList(savedWordsByUser, user.id)
      .filter((item) => item.textOriginal.toLowerCase().includes(query))
      .slice(0, limit);
    const collections = ensureList(collectionsByUser, user.id)
      .filter((item) => item.name.toLowerCase().includes(query) || (item.description ?? "").toLowerCase().includes(query))
      .slice(0, limit);
    const notes = ensureList(notesByUser, user.id)
      .filter((item) => item.content.toLowerCase().includes(query))
      .slice(0, limit);
    const graphs = ensureList(savedGraphsByUser, user.id)
      .filter((item) => item.title.toLowerCase().includes(query))
      .slice(0, limit);

    return HttpResponse.json({ words, collections, notes, graphs });
  }),

  http.get("http://localhost:3001/v1/me/export", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const memberships = collectionMembershipByUser.get(user.id) ?? {};
    const payload = {
      version: 1,
      exportedAt: nowIso(),
      collections: ensureList(collectionsByUser, user.id),
      savedWords: ensureList(savedWordsByUser, user.id).map((item) => ({
        ...item,
        collectionIds: memberships[item.id] ?? [],
      })),
      savedGraphs: ensureList(savedGraphsByUser, user.id),
      notes: ensureList(notesByUser, user.id),
      preferences: ensurePreference(user.id),
    };

    return HttpResponse.json(payload);
  }),

  http.post("http://localhost:3001/v1/me/import", async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user || user.status !== "ACTIVE") {
      return unauthorized();
    }

    const payload = (await request.json()) as {
      version?: number;
      collections?: Array<{ name: string; description?: string | null }>;
      savedWords?: Array<{ wordId: string; collectionNames?: string[] }>;
      notes?: Array<{ targetType: MockNote["targetType"]; targetId: string; content: string }>;
      savedGraphs?: Array<{ rootEntityId: string; title: string; depth?: number; filters?: unknown }>;
    };

    if (payload.version !== 1) {
      return HttpResponse.json({ error: { code: "IMPORT_INVALID", message: "Unsupported import schema version." } }, { status: 400 });
    }

    let importedCollections = 0;
    let importedWords = 0;
    let importedNotes = 0;
    let importedGraphs = 0;

    const collections = ensureList(collectionsByUser, user.id);
    const collectionNames = new Map(collections.map((item) => [item.name.toLowerCase(), item]));

    for (const collectionInput of payload.collections ?? []) {
      const name = collectionInput.name.trim();
      if (!name) {
        continue;
      }
      if (collectionNames.has(name.toLowerCase())) {
        continue;
      }
      const row: MockCollection = {
        id: nextId(),
        userId: user.id,
        name,
        description: collectionInput.description ?? null,
        position: collections.length,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      collections.push(row);
      collectionNames.set(name.toLowerCase(), row);
      importedCollections += 1;
    }

    const words = ensureList(savedWordsByUser, user.id);
    const membershipMap = collectionMembershipByUser.get(user.id) ?? {};

    for (const word of payload.savedWords ?? []) {
      const existing = words.find((item) => item.wordId === word.wordId);
      let row = existing;
      if (!row) {
        const details = wordDetailsById[word.wordId];
        row = {
          id: nextId(),
          userId: user.id,
          wordId: word.wordId,
          textOriginal: details?.textOriginal ?? word.wordId,
          language: details?.language ?? null,
          stage: details?.stage ?? null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        words.unshift(row);
        importedWords += 1;
      }

      for (const collectionName of word.collectionNames ?? []) {
        const key = collectionName.trim().toLowerCase();
        if (!key) {
          continue;
        }

        let collection = collectionNames.get(key);
        if (!collection) {
          collection = {
            id: nextId(),
            userId: user.id,
            name: collectionName.trim(),
            description: null,
            position: collections.length,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          collections.push(collection);
          collectionNames.set(key, collection);
          importedCollections += 1;
        }

        const ids = membershipMap[row.id] ?? [];
        if (!ids.includes(collection.id)) {
          ids.push(collection.id);
          membershipMap[row.id] = ids;
        }
      }
    }

    collectionMembershipByUser.set(user.id, membershipMap);

    const notes = ensureList(notesByUser, user.id);
    for (const note of payload.notes ?? []) {
      notes.unshift({
        id: nextId(),
        userId: user.id,
        targetType: note.targetType,
        targetId: note.targetId,
        content: note.content,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      importedNotes += 1;
    }

    const graphs = ensureList(savedGraphsByUser, user.id);
    for (const graph of payload.savedGraphs ?? []) {
      graphs.unshift({
        id: nextId(),
        userId: user.id,
        rootEntityId: graph.rootEntityId,
        title: graph.title,
        depth: Number(graph.depth ?? 3),
        filters: graph.filters ?? {},
        layoutPreference: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      importedGraphs += 1;
    }

    return HttpResponse.json({
      importedWords,
      importedCollections,
      importedNotes,
      importedGraphs,
      skippedDuplicates: 0,
    });
  }),

  http.get("http://localhost:3001/v1/search", ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.toLowerCase().trim() ?? "";

    const dictionary: Record<string, Array<{ wordId: string; textOriginal: string; language: string }>> = {
      father: [{ wordId: WORD_IDS.father, textOriginal: "father", language: "English" }],
      mother: [{ wordId: WORD_IDS.mother, textOriginal: "mother", language: "English" }],
      daughter: [{ wordId: WORD_IDS.daughter, textOriginal: "daughter", language: "English" }],
    };

    const direct = dictionary[query] ?? [];
    const results = direct.map((item) => ({
      id: item.wordId,
      wordId: item.wordId,
      type: "word",
      text: item.textOriginal,
      textOriginal: item.textOriginal,
      textNormalized: item.textOriginal.toLowerCase(),
      language: item.language,
      languageFamily: "Germanic",
      stage: "Modern English",
      isReconstructed: false,
      match: {
        type: "exact",
        score: 1,
      },
    }));

    return HttpResponse.json({
      query,
      total: results.length,
      filters: { language: null, family: null, type: null },
      results,
      metadata: { total: results.length, executionTimeMs: 1 },
    });
  }),

  http.get("http://localhost:3001/v1/graph/ancestors/:wordId", ({ params, request }) => {
    const wordId = String(params.wordId);
    const depth = Number(new URL(request.url).searchParams.get("depth") ?? "6");

    if (wordId !== WORD_IDS.father) {
      return HttpResponse.json({ wordId, depth, edges: [] });
    }

    return HttpResponse.json({
      wordId,
      depth,
      edges: [
        {
          edgeId: "edge-pie-pg",
          fromWordId: WORD_IDS.pieFather,
          toWordId: WORD_IDS.pgFather,
          relationType: "EVOLVED_FROM",
          confidence: 0.92,
          method: "manual",
          isDisputed: false,
          evidenceSummary: "Mock PIE to Proto-Germanic lineage",
          depth: 2,
          path: [WORD_IDS.pieFather, WORD_IDS.pgFather],
          sources: [],
        },
        {
          edgeId: "edge-pg-oe",
          fromWordId: WORD_IDS.pgFather,
          toWordId: WORD_IDS.oeFather,
          relationType: "EVOLVED_FROM",
          confidence: 0.95,
          method: "manual",
          isDisputed: false,
          evidenceSummary: "Mock Proto-Germanic to Old English",
          depth: 1,
          path: [WORD_IDS.pgFather, WORD_IDS.oeFather],
          sources: [],
        },
        {
          edgeId: "edge-oe-en",
          fromWordId: WORD_IDS.oeFather,
          toWordId: WORD_IDS.father,
          relationType: "EVOLVED_FROM",
          confidence: 0.97,
          method: "manual",
          isDisputed: false,
          evidenceSummary: "Mock Old English to Modern English",
          depth: 0,
          path: [WORD_IDS.oeFather, WORD_IDS.father],
          sources: [],
        },
      ],
    });
  }),

  http.get("http://localhost:3001/v1/graph/descendants/:wordId", ({ params, request }) => {
    const wordId = String(params.wordId);
    const depth = Number(new URL(request.url).searchParams.get("depth") ?? "3");

    if (wordId !== WORD_IDS.father) {
      return HttpResponse.json({ wordId, depth, edges: [] });
    }

    return HttpResponse.json({
      wordId,
      depth,
      edges: [
        {
          edgeId: "edge-en-daughter",
          fromWordId: WORD_IDS.father,
          toWordId: WORD_IDS.daughter,
          relationType: "EVOLVED_FROM",
          confidence: 0.78,
          method: "manual",
          isDisputed: false,
          evidenceSummary: "Mock descendant branch",
          depth: 1,
          path: [WORD_IDS.father, WORD_IDS.daughter],
          sources: [],
        },
      ],
    });
  }),

  http.get("http://localhost:3001/v1/graph/borrowings/:wordId", ({ params, request }) => {
    const wordId = String(params.wordId);
    const depth = Number(new URL(request.url).searchParams.get("depth") ?? "3");

    if (wordId !== WORD_IDS.father) {
      return HttpResponse.json({ wordId, depth, edges: [] });
    }

    return HttpResponse.json({
      wordId,
      depth,
      edges: [
        {
          edgeId: "edge-borrowing-1",
          fromWordId: WORD_IDS.oldNorse,
          toWordId: WORD_IDS.oeFather,
          relationType: "BORROWED_FROM",
          confidence: 0.67,
          method: "computed",
          isDisputed: false,
          evidenceSummary: "Mock borrowing signal",
          depth: 1,
          path: [WORD_IDS.oldNorse, WORD_IDS.oeFather],
          sources: [],
        },
      ],
    });
  }),

  http.get("http://localhost:3001/v1/graph/cognates/:wordId", ({ params, request }) => {
    const wordId = String(params.wordId);
    const depth = Number(new URL(request.url).searchParams.get("depth") ?? "2");

    if (wordId !== WORD_IDS.father) {
      return HttpResponse.json({ wordId, depth, edges: [] });
    }

    return HttpResponse.json({
      wordId,
      depth,
      edges: [
        {
          edgeId: "edge-cognate-1",
          fromWordId: WORD_IDS.oldNorse,
          toWordId: WORD_IDS.pgFather,
          relationType: "COGNATE_WITH",
          confidence: 0.73,
          method: "computed",
          isDisputed: false,
          evidenceSummary: "Mock cognate branch",
          depth: 1,
          path: [WORD_IDS.oldNorse, WORD_IDS.pgFather],
          sources: [],
        },
      ],
    });
  }),

  http.get("http://localhost:3001/v1/words/:wordId", ({ params }) => {
    const wordId = String(params.wordId);
    const details = wordDetailsById[wordId];

    if (!details) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json({
      wordId,
      textOriginal: details.textOriginal,
      textNormalized: details.textOriginal.toLowerCase(),
      language: details.language,
      stage: details.stage ?? null,
      meanings: [{ gloss: `Mock meaning for ${details.textOriginal}` }],
      sources: [{ title: "Mock Source", sourceLocator: "msw:1" }],
    });
  }),
];
