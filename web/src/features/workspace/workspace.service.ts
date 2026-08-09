import { apiFetch } from "@/lib/api-client";

export interface WorkspaceSummary {
  savedWords: number;
  savedGraphs: number;
  collections: number;
  notes: number;
  recent: Array<{ entityType: string; entityId: string; viewedAt: string }>;
}

export interface WorkspaceSearchResult {
  words: SavedWord[];
  collections: WorkspaceCollection[];
  notes: WorkspaceNote[];
  graphs: SavedGraph[];
}

export interface SavedWord {
  id: string;
  userId: string;
  wordId: string;
  textOriginal: string;
  language: string | null;
  stage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceCollection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceNote {
  id: string;
  userId: string;
  targetType: "WORD" | "LANGUAGE" | "RELATIONSHIP" | "GRAPH" | "COLLECTION";
  targetId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedGraph {
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

export interface WorkspacePreferences {
  userId: string;
  theme: string;
  interfaceLanguage: string;
  defaultGraphDepth: number;
  graphLayout: string;
  showMeanings: boolean;
  showSources: boolean;
  updatedAt: string;
}

export async function getWorkspaceSummary() {
  return apiFetch<WorkspaceSummary>("/v1/me/workspace-summary");
}

export async function listSavedWords() {
  return apiFetch<{ items: SavedWord[]; nextCursor: string | null }>("/v1/me/saved-words");
}

export async function saveWord(wordId: string) {
  return apiFetch<SavedWord>("/v1/me/saved-words", {
    method: "POST",
    body: JSON.stringify({ wordId }),
  });
}

export async function listBookmarks() {
  return apiFetch<{ items: SavedWord[]; nextCursor: string | null }>("/v1/me/bookmarks");
}

export async function saveBookmark(wordId: string) {
  return apiFetch<SavedWord>("/v1/me/bookmarks", {
    method: "POST",
    body: JSON.stringify({ wordId }),
  });
}

export async function deleteBookmark(bookmarkId: string) {
  return apiFetch<void>(`/v1/me/bookmarks/${encodeURIComponent(bookmarkId)}`, {
    method: "DELETE",
  });
}

export async function listCollections() {
  return apiFetch<WorkspaceCollection[]>("/v1/me/collections");
}

export async function createCollection(input: { name: string; description?: string }) {
  return apiFetch<WorkspaceCollection>("/v1/me/collections", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? null,
    }),
  });
}

export async function addSavedWordToCollection(collectionId: string, savedWordId: string) {
  return apiFetch<void>(`/v1/me/collections/${encodeURIComponent(collectionId)}/items`, {
    method: "POST",
    body: JSON.stringify({ savedWordId }),
  });
}

export async function bulkAddSavedWordsToCollection(collectionId: string, savedWordIds: string[]) {
  return apiFetch<{ added: number; notFound: number }>(`/v1/me/collections/${encodeURIComponent(collectionId)}/items/bulk-add`, {
    method: "POST",
    body: JSON.stringify({ savedWordIds }),
  });
}

export async function bulkRemoveSavedWordsFromCollection(collectionId: string, savedWordIds: string[]) {
  return apiFetch<{ removed: number }>(`/v1/me/collections/${encodeURIComponent(collectionId)}/items/bulk-remove`, {
    method: "POST",
    body: JSON.stringify({ savedWordIds }),
  });
}

export async function listNotes() {
  return apiFetch<{ items: WorkspaceNote[]; nextCursor: string | null }>("/v1/me/notes");
}

export async function createNote(input: { targetType: WorkspaceNote["targetType"]; targetId: string; content: string }) {
  return apiFetch<WorkspaceNote>("/v1/me/notes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function bulkDeleteNotes(noteIds: string[]) {
  return apiFetch<{ deleted: number }>("/v1/me/notes/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ noteIds }),
  });
}

export async function listSavedGraphs() {
  return apiFetch<{ items: SavedGraph[]; nextCursor: string | null }>("/v1/me/saved-graphs");
}

export async function saveGraph(input: { rootEntityId: string; title: string; depth: number; filters?: unknown; layoutPreference?: string | null }) {
  return apiFetch<SavedGraph>("/v1/me/saved-graphs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function addHistory(query: string) {
  return apiFetch<void>("/v1/me/history", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function upsertRecent(input: { entityType: string; entityId: string }) {
  return apiFetch<void>("/v1/me/recent", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getPreferences() {
  return apiFetch<WorkspacePreferences>("/v1/me/preferences");
}

export async function updatePreferences(input: Partial<Omit<WorkspacePreferences, "userId" | "updatedAt">>) {
  return apiFetch<WorkspacePreferences>("/v1/me/preferences", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function exportWorkspace() {
  return apiFetch<unknown>("/v1/me/export");
}

export async function searchWorkspace(query: string, limit = 20) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiFetch<WorkspaceSearchResult>(`/v1/me/workspace-search?${params.toString()}`);
}

export async function importWorkspace(payload: unknown) {
  return apiFetch<unknown>("/v1/me/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
