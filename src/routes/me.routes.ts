import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../auth/auth.middleware.js";
import { AuthError, type AuthOrchestrator } from "../auth/auth.orchestrator.js";
import { WorkspaceError, WorkspaceOrchestrator } from "../workspace/workspace.orchestrator.js";

function fail(res: { status: (code: number) => { json: (body: unknown) => void } }, error: unknown): void {
  if (error instanceof WorkspaceError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Workspace operation failed." } });
}

export function buildMeRouter(auth: AuthOrchestrator, workspace: WorkspaceOrchestrator): Router {
  const router = Router();
  router.use(requireAuth(auth));

  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 180,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many write operations. Please try again later." } },
  });

  const notesLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many note operations. Please slow down." } },
  });

  const exportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Export limit exceeded. Try again later." } },
  });

  const importLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Import limit exceeded. Try again later." } },
  });

  router.get("/", async (req, res) => {
    const user = req.authUser;
    if (!user) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    });
  });

  router.get("/workspace-summary", async (req, res) => {
    try {
      return res.status(200).json(await workspace.getSummary(req.authUser!.id));
    } catch (error) {
      fail(res, error);
    }
  });

  router.get("/saved-words", async (req, res) => {
    try {
      const limit = Number(req.query.limit ?? 20);
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      return res.status(200).json(await workspace.listSavedWords(req.authUser!.id, { limit, cursor }));
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/saved-words", writeLimiter, async (req, res) => {
    try {
      const savedWord = await workspace.saveWord(req.authUser!.id, String(req.body?.wordId ?? ""));
      return res.status(200).json(savedWord);
    } catch (error) {
      fail(res, error);
    }
  });

  router.delete("/saved-words/:savedWordId", writeLimiter, async (req, res) => {
    try {
      const deleted = await workspace.deleteSavedWord(req.authUser!.id, req.params.savedWordId);
      if (!deleted) {
        return res.status(404).json({ error: { code: "RESOURCE_NOT_FOUND", message: "Saved word not found." } });
      }
      return res.status(204).send();
    } catch (error) {
      fail(res, error);
    }
  });

  router.get("/bookmarks", async (req, res) => {
    try {
      const limit = Number(req.query.limit ?? 20);
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      return res.status(200).json(await workspace.listBookmarks(req.authUser!.id, { limit, cursor }));
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/bookmarks", writeLimiter, async (req, res) => {
    try {
      const bookmark = await workspace.saveBookmark(req.authUser!.id, String(req.body?.wordId ?? ""));
      return res.status(200).json(bookmark);
    } catch (error) {
      fail(res, error);
    }
  });

  router.delete("/bookmarks/:bookmarkId", writeLimiter, async (req, res) => {
    try {
      const deleted = await workspace.deleteBookmark(req.authUser!.id, req.params.bookmarkId);
      if (!deleted) {
        return res.status(404).json({ error: { code: "RESOURCE_NOT_FOUND", message: "Bookmark not found." } });
      }
      return res.status(204).send();
    } catch (error) {
      fail(res, error);
    }
  });

  router.get("/collections", async (req, res) => {
    try {
      return res.status(200).json(await workspace.listCollections(req.authUser!.id));
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/collections", writeLimiter, async (req, res) => {
    try {
      const collection = await workspace.createCollection(req.authUser!.id, {
        name: String(req.body?.name ?? ""),
        description: typeof req.body?.description === "string" ? req.body.description : null,
      });
      return res.status(201).json(collection);
    } catch (error) {
      fail(res, error);
    }
  });

  router.patch("/collections/:collectionId", writeLimiter, async (req, res) => {
    try {
      const collection = await workspace.updateCollection(req.authUser!.id, req.params.collectionId, {
        name: typeof req.body?.name === "string" ? req.body.name : undefined,
        description: typeof req.body?.description === "string" || req.body?.description === null ? req.body.description : undefined,
        position: typeof req.body?.position === "number" ? req.body.position : undefined,
      });
      return res.status(200).json(collection);
    } catch (error) {
      fail(res, error);
    }
  });

  router.delete("/collections/:collectionId", writeLimiter, async (req, res) => {
    try {
      await workspace.deleteCollection(req.authUser!.id, req.params.collectionId);
      return res.status(204).send();
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/collections/:collectionId/items", writeLimiter, async (req, res) => {
    try {
      await workspace.addSavedWordToCollection(req.authUser!.id, String(req.body?.savedWordId ?? ""), req.params.collectionId);
      return res.status(204).send();
    } catch (error) {
      fail(res, error);
    }
  });

  router.delete("/collections/:collectionId/items/:savedWordId", writeLimiter, async (req, res) => {
    try {
      await workspace.removeSavedWordFromCollection(req.authUser!.id, req.params.savedWordId, req.params.collectionId);
      return res.status(204).send();
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/collections/:collectionId/items/bulk-add", writeLimiter, async (req, res) => {
    try {
      const result = await workspace.bulkAddSavedWordsToCollection(req.authUser!.id, {
        collectionId: req.params.collectionId,
        savedWordIds: req.body?.savedWordIds,
      });
      return res.status(200).json(result);
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/collections/:collectionId/items/bulk-remove", writeLimiter, async (req, res) => {
    try {
      const result = await workspace.bulkRemoveSavedWordsFromCollection(req.authUser!.id, {
        collectionId: req.params.collectionId,
        savedWordIds: req.body?.savedWordIds,
      });
      return res.status(200).json(result);
    } catch (error) {
      fail(res, error);
    }
  });

  router.get("/notes", async (req, res) => {
    try {
      const limit = Number(req.query.limit ?? 20);
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      return res.status(200).json(await workspace.listNotes(req.authUser!.id, { limit, cursor }));
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/notes", notesLimiter, async (req, res) => {
    try {
      const note = await workspace.createNote(req.authUser!.id, {
        targetType: String(req.body?.targetType ?? ""),
        targetId: String(req.body?.targetId ?? ""),
        content: String(req.body?.content ?? ""),
      });
      return res.status(201).json(note);
    } catch (error) {
      fail(res, error);
    }
  });

  router.patch("/notes/:noteId", notesLimiter, async (req, res) => {
    try {
      const note = await workspace.updateNote(req.authUser!.id, req.params.noteId, String(req.body?.content ?? ""));
      return res.status(200).json(note);
    } catch (error) {
      fail(res, error);
    }
  });

  router.delete("/notes/:noteId", notesLimiter, async (req, res) => {
    try {
      await workspace.deleteNote(req.authUser!.id, req.params.noteId);
      return res.status(204).send();
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/notes/bulk-delete", notesLimiter, async (req, res) => {
    try {
      const result = await workspace.bulkDeleteNotes(req.authUser!.id, req.body?.noteIds);
      return res.status(200).json(result);
    } catch (error) {
      fail(res, error);
    }
  });

  router.get("/saved-graphs", async (req, res) => {
    try {
      const limit = Number(req.query.limit ?? 20);
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      return res.status(200).json(await workspace.listSavedGraphs(req.authUser!.id, { limit, cursor }));
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/saved-graphs", writeLimiter, async (req, res) => {
    try {
      const graph = await workspace.createSavedGraph(req.authUser!.id, {
        rootEntityId: String(req.body?.rootEntityId ?? ""),
        title: typeof req.body?.title === "string" ? req.body.title : undefined,
        depth: typeof req.body?.depth === "number" ? req.body.depth : undefined,
        filters: req.body?.filters,
        layoutPreference: typeof req.body?.layoutPreference === "string" ? req.body.layoutPreference : null,
      });
      return res.status(201).json(graph);
    } catch (error) {
      fail(res, error);
    }
  });

  router.patch("/saved-graphs/:graphId", writeLimiter, async (req, res) => {
    try {
      const graph = await workspace.renameSavedGraph(req.authUser!.id, req.params.graphId, String(req.body?.title ?? ""));
      return res.status(200).json(graph);
    } catch (error) {
      fail(res, error);
    }
  });

  router.delete("/saved-graphs/:graphId", writeLimiter, async (req, res) => {
    try {
      await workspace.deleteSavedGraph(req.authUser!.id, req.params.graphId);
      return res.status(204).send();
    } catch (error) {
      fail(res, error);
    }
  });

  router.get("/history", async (req, res) => {
    try {
      const limit = Number(req.query.limit ?? 20);
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      return res.status(200).json(await workspace.listHistory(req.authUser!.id, { limit, cursor }));
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/history", writeLimiter, async (req, res) => {
    try {
      await workspace.addHistory(req.authUser!.id, String(req.body?.query ?? ""));
      return res.status(204).send();
    } catch (error) {
      fail(res, error);
    }
  });

  router.delete("/history", writeLimiter, async (req, res) => {
    try {
      await workspace.clearHistory(req.authUser!.id);
      return res.status(204).send();
    } catch (error) {
      fail(res, error);
    }
  });

  router.get("/recent", async (req, res) => {
    try {
      const limit = Number(req.query.limit ?? 20);
      return res.status(200).json(await workspace.listRecent(req.authUser!.id, limit));
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/recent", writeLimiter, async (req, res) => {
    try {
      await workspace.upsertRecent(req.authUser!.id, {
        entityType: String(req.body?.entityType ?? ""),
        entityId: String(req.body?.entityId ?? ""),
      });
      return res.status(204).send();
    } catch (error) {
      fail(res, error);
    }
  });

  router.get("/preferences", async (req, res) => {
    try {
      return res.status(200).json(await workspace.getPreferences(req.authUser!.id));
    } catch (error) {
      fail(res, error);
    }
  });

  router.patch("/preferences", writeLimiter, async (req, res) => {
    try {
      const next = await workspace.updatePreferences(req.authUser!.id, {
        theme: typeof req.body?.theme === "string" ? req.body.theme : undefined,
        interfaceLanguage: typeof req.body?.interfaceLanguage === "string" ? req.body.interfaceLanguage : undefined,
        defaultGraphDepth: typeof req.body?.defaultGraphDepth === "number" ? req.body.defaultGraphDepth : undefined,
        graphLayout: typeof req.body?.graphLayout === "string" ? req.body.graphLayout : undefined,
        showMeanings: typeof req.body?.showMeanings === "boolean" ? req.body.showMeanings : undefined,
        showSources: typeof req.body?.showSources === "boolean" ? req.body.showSources : undefined,
      });
      return res.status(200).json(next);
    } catch (error) {
      fail(res, error);
    }
  });

  router.get("/export", exportLimiter, async (req, res) => {
    try {
      return res.status(200).json(await workspace.exportWorkspace(req.authUser!.id));
    } catch (error) {
      fail(res, error);
    }
  });

  router.get("/workspace-search", async (req, res) => {
    try {
      const query = String(req.query.q ?? "");
      const limit = Number(req.query.limit ?? 20);
      return res.status(200).json(await workspace.searchWorkspace(req.authUser!.id, { query, limit }));
    } catch (error) {
      fail(res, error);
    }
  });

  router.post("/import", importLimiter, async (req, res) => {
    try {
      const report = await workspace.importWorkspace(req.authUser!.id, req.body);
      return res.status(200).json(report);
    } catch (error) {
      fail(res, error);
    }
  });

  router.delete("/", writeLimiter, async (req, res) => {
    try {
      const password = String(req.body?.password ?? "");
      await auth.deleteAccount(req.authUser!.id, password);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: { code: error.code, message: error.message } });
      }
      return fail(res, error);
    }
  });

  return router;
}
