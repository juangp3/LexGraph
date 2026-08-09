"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import {
  addSavedWordToCollection,
  bulkAddSavedWordsToCollection,
  bulkDeleteNotes,
  bulkRemoveSavedWordsFromCollection,
  createCollection,
  createNote,
  deleteBookmark,
  exportWorkspace,
  getPreferences,
  getWorkspaceSummary,
  listBookmarks,
  listCollections,
  listNotes,
  listSavedGraphs,
  listSavedWords,
  saveGraph,
  saveBookmark,
  saveWord,
  searchWorkspace,
  upsertRecent,
  type SavedWord,
} from "@/features/workspace/workspace.service";

interface WorkspaceNotebookPanelProps {
  selectedWordId: string | null;
  selectedWordText: string | null;
  onOpenWord: (wordId: string, label: string) => void;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Operation failed.";
}

export function WorkspaceNotebookPanel({ selectedWordId, selectedWordText, onOpenWord }: WorkspaceNotebookPanelProps) {
  const showToast = useToast();
  const queryClient = useQueryClient();
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [noteContent, setNoteContent] = useState("");
  const [selectedSavedWordIds, setSelectedSavedWordIds] = useState<string[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [workspaceQuery, setWorkspaceQuery] = useState("");

  const summaryQuery = useQuery({ queryKey: ["workspace-summary"], queryFn: getWorkspaceSummary });
  const savedWordsQuery = useQuery({ queryKey: ["saved-words"], queryFn: listSavedWords });
  const bookmarksQuery = useQuery({ queryKey: ["bookmarks"], queryFn: listBookmarks });
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: listCollections });
  const notesQuery = useQuery({ queryKey: ["notes"], queryFn: listNotes });
  const savedGraphsQuery = useQuery({ queryKey: ["saved-graphs"], queryFn: listSavedGraphs });
  const workspaceSearchQuery = useQuery({
    queryKey: ["workspace-search", workspaceQuery],
    queryFn: () => searchWorkspace(workspaceQuery, 8),
    enabled: workspaceQuery.trim().length >= 2,
  });
  const preferencesQuery = useQuery({ queryKey: ["workspace-preferences"], queryFn: getPreferences });

  const preferredDepth = useMemo(() => {
    const raw = preferencesQuery.data?.defaultGraphDepth;
    if (typeof raw !== "number" || Number.isNaN(raw)) {
      return 3;
    }
    return Math.max(1, Math.min(8, Math.trunc(raw)));
  }, [preferencesQuery.data?.defaultGraphDepth]);

  const preferredLayout = useMemo(() => {
    const layout = preferencesQuery.data?.graphLayout;
    if (layout === "radial" || layout === "force-directed" || layout === "grid" || layout === "hierarchical") {
      return layout;
    }
    return "hierarchical";
  }, [preferencesQuery.data?.graphLayout]);

  useEffect(() => {
    if (!selectedWordId) {
      return;
    }

    void upsertRecent({ entityType: "WORD", entityId: selectedWordId }).catch(() => {
      // no-op: recent tracking is best-effort
    });
  }, [selectedWordId]);

  const selectedSavedWord = useMemo<SavedWord | null>(() => {
    if (!selectedWordId) {
      return null;
    }

    return savedWordsQuery.data?.items.find((item) => item.wordId === selectedWordId) ?? null;
  }, [savedWordsQuery.data?.items, selectedWordId]);

  const refreshWorkspace = useMemo(
    () => async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspace-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["saved-words"] }),
        queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
        queryClient.invalidateQueries({ queryKey: ["collections"] }),
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["saved-graphs"] }),
      ]);
    },
    [queryClient],
  );

  const saveWordMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWordId) {
        throw new Error("Select a word before saving.");
      }
      return saveWord(selectedWordId);
    },
    onSuccess: async (payload) => {
      showToast({ title: "Saved", description: `${payload.textOriginal || selectedWordText || "Word"} added to workspace.` });
      await refreshWorkspace();
    },
    onError: (error) => {
      showToast({ title: "Save failed", description: describeError(error) });
    },
  });

  const createCollectionMutation = useMutation({
    mutationFn: async () => createCollection({
      name: newCollectionName,
      description: newCollectionDescription || undefined,
    }),
    onSuccess: async (collection) => {
      setNewCollectionName("");
      setNewCollectionDescription("");
      setSelectedCollectionId(collection.id);
      showToast({ title: "Collection created", description: collection.name });
      await refreshWorkspace();
    },
    onError: (error) => {
      showToast({ title: "Collection failed", description: describeError(error) });
    },
  });

  const addToCollectionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCollectionId) {
        throw new Error("Choose a collection first.");
      }
      if (!selectedSavedWord) {
        throw new Error("Save this word before adding it to a collection.");
      }
      return addSavedWordToCollection(selectedCollectionId, selectedSavedWord.id);
    },
    onSuccess: async () => {
      const collectionName = collectionsQuery.data?.find((item) => item.id === selectedCollectionId)?.name ?? "Collection";
      showToast({ title: "Added to collection", description: collectionName });
      await refreshWorkspace();
    },
    onError: (error) => {
      showToast({ title: "Add failed", description: describeError(error) });
    },
  });

  const saveBookmarkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWordId) {
        throw new Error("Select a word before bookmarking.");
      }
      return saveBookmark(selectedWordId);
    },
    onSuccess: async (payload) => {
      showToast({ title: "Bookmarked", description: `${payload.textOriginal || selectedWordText || "Word"} saved as bookmark.` });
      await refreshWorkspace();
    },
    onError: (error) => {
      showToast({ title: "Bookmark failed", description: describeError(error) });
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCollectionId) {
        throw new Error("Choose a collection first.");
      }
      if (selectedSavedWordIds.length === 0) {
        throw new Error("Select at least one saved word.");
      }
      return bulkAddSavedWordsToCollection(selectedCollectionId, selectedSavedWordIds);
    },
    onSuccess: async (payload) => {
      showToast({ title: "Bulk add completed", description: `Added ${payload.added} words.` });
      await refreshWorkspace();
    },
    onError: (error) => {
      showToast({ title: "Bulk add failed", description: describeError(error) });
    },
  });

  const bulkRemoveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCollectionId) {
        throw new Error("Choose a collection first.");
      }
      if (selectedSavedWordIds.length === 0) {
        throw new Error("Select at least one saved word.");
      }
      return bulkRemoveSavedWordsFromCollection(selectedCollectionId, selectedSavedWordIds);
    },
    onSuccess: async (payload) => {
      showToast({ title: "Bulk remove completed", description: `Removed ${payload.removed} words.` });
      await refreshWorkspace();
    },
    onError: (error) => {
      showToast({ title: "Bulk remove failed", description: describeError(error) });
    },
  });

  const bulkDeleteNotesMutation = useMutation({
    mutationFn: async () => {
      if (selectedNoteIds.length === 0) {
        throw new Error("Select at least one note.");
      }
      return bulkDeleteNotes(selectedNoteIds);
    },
    onSuccess: async (payload) => {
      setSelectedNoteIds([]);
      showToast({ title: "Bulk delete completed", description: `Deleted ${payload.deleted} notes.` });
      await refreshWorkspace();
    },
    onError: (error) => {
      showToast({ title: "Bulk note delete failed", description: describeError(error) });
    },
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: async (bookmarkId: string) => deleteBookmark(bookmarkId),
    onSuccess: async () => {
      showToast({ title: "Bookmark removed", description: "Bookmark deleted." });
      await refreshWorkspace();
    },
    onError: (error) => {
      showToast({ title: "Remove bookmark failed", description: describeError(error) });
    },
  });

  const noteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWordId) {
        throw new Error("Select a word first.");
      }
      return createNote({
        targetType: "WORD",
        targetId: selectedWordId,
        content: noteContent,
      });
    },
    onSuccess: async () => {
      setNoteContent("");
      showToast({ title: "Note saved", description: "Your workspace note was attached to this word." });
      await refreshWorkspace();
    },
    onError: (error) => {
      showToast({ title: "Note failed", description: describeError(error) });
    },
  });

  const saveGraphMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWordId) {
        throw new Error("Select a word before saving a graph.");
      }
      return saveGraph({
        rootEntityId: selectedWordId,
        title: selectedWordText ? `${selectedWordText} - Etymological Lineage` : "Saved Graph",
        depth: preferredDepth,
        layoutPreference: preferredLayout,
      });
    },
    onSuccess: async () => {
      showToast({ title: "Graph saved", description: "Current graph query has been saved." });
      await refreshWorkspace();
    },
    onError: (error) => {
      showToast({ title: "Graph save failed", description: describeError(error) });
    },
  });

  const exportMutation = useMutation({
    mutationFn: exportWorkspace,
    onSuccess: (payload) => {
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lexgraph-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast({ title: "Export ready", description: "Workspace JSON export downloaded." });
    },
    onError: (error) => {
      showToast({ title: "Export failed", description: describeError(error) });
    },
  });

  const savedWords = savedWordsQuery.data?.items ?? [];
  const bookmarks = bookmarksQuery.data?.items ?? [];
  const collections = collectionsQuery.data ?? [];
  const notes = notesQuery.data?.items ?? [];
  const savedGraphs = savedGraphsQuery.data?.items ?? [];

  const toggleSavedWordSelection = (savedWordId: string) => {
    setSelectedSavedWordIds((current) => current.includes(savedWordId)
      ? current.filter((item) => item !== savedWordId)
      : [...current, savedWordId]);
  };

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds((current) => current.includes(noteId)
      ? current.filter((item) => item !== noteId)
      : [...current, noteId]);
  };

  return (
    <section className="lex-card rounded-[var(--radius-2xl)] p-4" aria-label="Workspace notebook panel" data-testid="workspace-notebook-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">My workspace</p>
          <h2 className="text-lg font-semibold text-foreground">Research notebook</h2>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => exportMutation.mutate()} data-testid="workspace-export-button">
          Export
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-border/70 bg-background/60 p-2">Saved words: <strong>{summaryQuery.data?.savedWords ?? 0}</strong></div>
        <div className="rounded-lg border border-border/70 bg-background/60 p-2">Collections: <strong>{summaryQuery.data?.collections ?? 0}</strong></div>
        <div className="rounded-lg border border-border/70 bg-background/60 p-2">Notes: <strong>{summaryQuery.data?.notes ?? 0}</strong></div>
        <div className="rounded-lg border border-border/70 bg-background/60 p-2">Graphs: <strong>{summaryQuery.data?.savedGraphs ?? 0}</strong></div>
      </div>

      <div className="mt-4 space-y-3">
        <Button
          type="button"
          className="w-full"
          onClick={() => saveWordMutation.mutate()}
          disabled={!selectedWordId || saveWordMutation.isPending}
          data-testid="workspace-save-word-button"
        >
          Save selected word
        </Button>

        <Button
          type="button"
          className="w-full"
          variant="outline"
          onClick={() => saveBookmarkMutation.mutate()}
          disabled={!selectedWordId || saveBookmarkMutation.isPending}
          data-testid="workspace-bookmark-word-button"
        >
          Bookmark selected word
        </Button>

        <div className="rounded-xl border border-border/70 bg-background/40 p-3">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Create collection</p>
          <Input
            value={newCollectionName}
            onChange={(event) => setNewCollectionName(event.target.value)}
            placeholder="Collection name"
            data-testid="workspace-collection-name-input"
          />
          <Input
            className="mt-2"
            value={newCollectionDescription}
            onChange={(event) => setNewCollectionDescription(event.target.value)}
            placeholder="Description (optional)"
            data-testid="workspace-collection-description-input"
          />
          <Button
            type="button"
            className="mt-2 w-full"
            variant="outline"
            onClick={() => createCollectionMutation.mutate()}
            disabled={createCollectionMutation.isPending}
            data-testid="workspace-create-collection-button"
          >
            Create collection
          </Button>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/40 p-3">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Add saved word to collection</p>
          <select
            value={selectedCollectionId}
            onChange={(event) => setSelectedCollectionId(event.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
            data-testid="workspace-collection-select"
          >
            <option value="">Select collection</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>{collection.name}</option>
            ))}
          </select>
          <Button
            type="button"
            className="mt-2 w-full"
            variant="outline"
            onClick={() => addToCollectionMutation.mutate()}
            disabled={!selectedSavedWord || !selectedCollectionId || addToCollectionMutation.isPending}
            data-testid="workspace-add-to-collection-button"
          >
            Add to collection
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => bulkAddMutation.mutate()}
              disabled={!selectedCollectionId || selectedSavedWordIds.length === 0 || bulkAddMutation.isPending}
              data-testid="workspace-bulk-add-to-collection-button"
            >
              Bulk add
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => bulkRemoveMutation.mutate()}
              disabled={!selectedCollectionId || selectedSavedWordIds.length === 0 || bulkRemoveMutation.isPending}
              data-testid="workspace-bulk-remove-from-collection-button"
            >
              Bulk remove
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/40 p-3">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Attach note to selected word</p>
          <Textarea
            value={noteContent}
            onChange={(event) => setNoteContent(event.target.value)}
            placeholder="Write your linguistic research note"
            rows={4}
            data-testid="workspace-note-textarea"
          />
          <Button
            type="button"
            className="mt-2 w-full"
            variant="outline"
            onClick={() => noteMutation.mutate()}
            disabled={!selectedWordId || noteMutation.isPending}
            data-testid="workspace-save-note-button"
          >
            Save note
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => saveGraphMutation.mutate()}
          disabled={!selectedWordId || saveGraphMutation.isPending}
          data-testid="workspace-save-graph-button"
        >
          Save current graph
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-border/70 bg-background/40 p-3" data-testid="workspace-search-list">
          <h3 className="text-sm font-semibold">Workspace search</h3>
          <Input
            className="mt-2"
            value={workspaceQuery}
            onChange={(event) => setWorkspaceQuery(event.target.value)}
            placeholder="Search notes, collections, bookmarks..."
            data-testid="workspace-search-input"
          />
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {workspaceQuery.trim().length < 2 ? (
              <li>Type 2+ characters.</li>
            ) : (
              <>
                <li>Words: {workspaceSearchQuery.data?.words.length ?? 0}</li>
                <li>Collections: {workspaceSearchQuery.data?.collections.length ?? 0}</li>
                <li>Notes: {workspaceSearchQuery.data?.notes.length ?? 0}</li>
                <li>Graphs: {workspaceSearchQuery.data?.graphs.length ?? 0}</li>
              </>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-border/70 bg-background/40 p-3" data-testid="workspace-bookmarks-list">
          <h3 className="text-sm font-semibold">Bookmarks</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {bookmarks.slice(0, 4).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span>{item.textOriginal || item.wordId}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBookmarkMutation.mutate(item.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
            {bookmarks.length === 0 ? <li className="text-xs text-muted-foreground">No bookmarks yet.</li> : null}
          </ul>
        </section>

        <section className="rounded-xl border border-border/70 bg-background/40 p-3" data-testid="workspace-saved-words-list">
          <h3 className="text-sm font-semibold">Saved words</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {savedWords.slice(0, 5).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <div>
                  <label className="mr-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={selectedSavedWordIds.includes(item.id)}
                      onChange={() => toggleSavedWordSelection(item.id)}
                    />
                    bulk
                  </label>
                  <p className="font-medium">{item.textOriginal || item.wordId}</p>
                  <p className="text-xs text-muted-foreground">{item.language || "Unknown"}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => onOpenWord(item.wordId, item.textOriginal || item.wordId)}>
                  Open
                </Button>
              </li>
            ))}
            {savedWords.length === 0 ? <li className="text-xs text-muted-foreground">No saved words yet.</li> : null}
          </ul>
        </section>

        <section className="rounded-xl border border-border/70 bg-background/40 p-3" data-testid="workspace-collections-list">
          <h3 className="text-sm font-semibold">Collections</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {collections.slice(0, 5).map((collection) => (
              <li key={collection.id} className="flex items-center justify-between gap-2">
                <span>{collection.name}</span>
                <span className="text-xs text-muted-foreground">#{collection.position + 1}</span>
              </li>
            ))}
            {collections.length === 0 ? <li className="text-xs text-muted-foreground">No collections yet.</li> : null}
          </ul>
        </section>

        <section className="rounded-xl border border-border/70 bg-background/40 p-3" data-testid="workspace-notes-list">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Notes</h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => bulkDeleteNotesMutation.mutate()}
              disabled={selectedNoteIds.length === 0 || bulkDeleteNotesMutation.isPending}
              data-testid="workspace-bulk-delete-notes-button"
            >
              Bulk delete
            </Button>
          </div>
          <ul className="mt-2 space-y-2 text-sm">
            {notes.slice(0, 4).map((note) => (
              <li key={note.id} className="text-xs text-muted-foreground">
                <label className="mr-2 inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selectedNoteIds.includes(note.id)}
                    onChange={() => toggleNoteSelection(note.id)}
                  />
                  pick
                </label>
                {note.content}
              </li>
            ))}
            {notes.length === 0 ? <li className="text-xs text-muted-foreground">No notes yet.</li> : null}
          </ul>
        </section>

        <section className="rounded-xl border border-border/70 bg-background/40 p-3" data-testid="workspace-graphs-list">
          <h3 className="text-sm font-semibold">Saved graphs</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {savedGraphs.slice(0, 4).map((graph) => (
              <li key={graph.id} className="text-xs text-muted-foreground">{graph.title}</li>
            ))}
            {savedGraphs.length === 0 ? <li className="text-xs text-muted-foreground">No saved graphs yet.</li> : null}
          </ul>
        </section>
      </div>
    </section>
  );
}
