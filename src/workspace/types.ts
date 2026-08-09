export type NoteTargetType = "WORD" | "LANGUAGE" | "RELATIONSHIP" | "GRAPH" | "COLLECTION";

export interface WorkspaceCollection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
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

export interface WorkspaceNote {
  id: string;
  userId: string;
  targetType: NoteTargetType;
  targetId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchHistoryItem {
  id: string;
  userId: string;
  query: string;
  searchedAt: string;
}

export interface RecentViewItem {
  userId: string;
  entityType: string;
  entityId: string;
  viewedAt: string;
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

export interface WorkspaceSummary {
  savedWords: number;
  savedGraphs: number;
  collections: number;
  notes: number;
  recent: RecentViewItem[];
}

export interface WorkspaceSearchResult {
  words: SavedWord[];
  collections: WorkspaceCollection[];
  notes: WorkspaceNote[];
  graphs: SavedGraph[];
}

export interface WorkspaceExportPayload {
  version: number;
  exportedAt: string;
  collections: WorkspaceCollection[];
  savedWords: Array<SavedWord & { collectionIds: string[] }>;
  savedGraphs: SavedGraph[];
  notes: WorkspaceNote[];
  preferences: WorkspacePreferences;
}

export interface WorkspaceImportPayload {
  version: number;
  collections?: Array<{ name: string; description?: string | null }>;
  savedWords?: Array<{ wordId: string; collectionNames?: string[] }>;
  savedGraphs?: Array<{
    rootEntityId: string;
    title: string;
    depth?: number;
    filters?: unknown;
    layoutPreference?: string | null;
  }>;
  notes?: Array<{
    targetType: NoteTargetType;
    targetId: string;
    content: string;
  }>;
  preferences?: Partial<Omit<WorkspacePreferences, "userId" | "updatedAt">>;
}

export interface WorkspaceStore {
  listSavedWords(userId: string, limit: number, cursor?: string): Promise<{ items: SavedWord[]; nextCursor: string | null }>;
  saveWord(userId: string, wordId: string): Promise<SavedWord>;
  deleteSavedWord(userId: string, savedWordId: string): Promise<boolean>;
  listBookmarks(userId: string, limit: number, cursor?: string): Promise<{ items: SavedWord[]; nextCursor: string | null }>;
  saveBookmark(userId: string, wordId: string): Promise<SavedWord>;
  deleteBookmark(userId: string, bookmarkId: string): Promise<boolean>;
  listCollections(userId: string): Promise<WorkspaceCollection[]>;
  createCollection(userId: string, input: { name: string; description: string | null }): Promise<WorkspaceCollection>;
  updateCollection(userId: string, collectionId: string, input: { name?: string; description?: string | null; position?: number }): Promise<WorkspaceCollection | null>;
  deleteCollection(userId: string, collectionId: string): Promise<boolean>;
  addSavedWordToCollection(userId: string, savedWordId: string, collectionId: string): Promise<boolean>;
  removeSavedWordFromCollection(userId: string, savedWordId: string, collectionId: string): Promise<boolean>;
  bulkAddSavedWordsToCollection(userId: string, savedWordIds: string[], collectionId: string): Promise<{ added: number; notFound: number }>;
  bulkRemoveSavedWordsFromCollection(userId: string, savedWordIds: string[], collectionId: string): Promise<{ removed: number }>;
  listNotes(userId: string, limit: number, cursor?: string): Promise<{ items: WorkspaceNote[]; nextCursor: string | null }>;
  createNote(userId: string, input: { targetType: NoteTargetType; targetId: string; content: string }): Promise<WorkspaceNote>;
  updateNote(userId: string, noteId: string, content: string): Promise<WorkspaceNote | null>;
  deleteNote(userId: string, noteId: string): Promise<boolean>;
  bulkDeleteNotes(userId: string, noteIds: string[]): Promise<{ deleted: number }>;
  listSavedGraphs(userId: string, limit: number, cursor?: string): Promise<{ items: SavedGraph[]; nextCursor: string | null }>;
  createSavedGraph(
    userId: string,
    input: { rootEntityId: string; title: string; depth: number; filters: unknown; layoutPreference: string | null },
  ): Promise<SavedGraph>;
  updateSavedGraphTitle(userId: string, graphId: string, title: string): Promise<SavedGraph | null>;
  deleteSavedGraph(userId: string, graphId: string): Promise<boolean>;
  listHistory(userId: string, limit: number, cursor?: string): Promise<{ items: SearchHistoryItem[]; nextCursor: string | null }>;
  addHistory(userId: string, query: string): Promise<void>;
  clearHistory(userId: string): Promise<void>;
  listRecentViews(userId: string, limit: number): Promise<RecentViewItem[]>;
  upsertRecentView(userId: string, input: { entityType: string; entityId: string }): Promise<void>;
  getPreferences(userId: string): Promise<WorkspacePreferences>;
  updatePreferences(userId: string, patch: Partial<Omit<WorkspacePreferences, "userId" | "updatedAt">>): Promise<WorkspacePreferences>;
  getSummary(userId: string): Promise<WorkspaceSummary>;
  getCollectionMemberships(userId: string): Promise<Record<string, string[]>>;
  searchWorkspace(userId: string, query: string, limit: number): Promise<WorkspaceSearchResult>;
}
