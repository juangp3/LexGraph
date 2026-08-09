import { expect, test, type Page } from "@playwright/test";

function uniqueEmail(): string {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  return `e2e-${suffix}@lexgraph.test`;
}

async function setupMockApi(page: Page) {
  const now = () => new Date().toISOString();
  const user = {
    id: "90000000-0000-4000-8000-000000000001",
    email: "",
    displayName: "E2E Explorer",
    avatarUrl: null,
    status: "ACTIVE",
    createdAt: now(),
    updatedAt: now(),
    lastLoginAt: now(),
  };

  const savedWords: Array<{ id: string; wordId: string; textOriginal: string; language: string }> = [];
  const collections: Array<{ id: string; name: string; description: string | null; position: number }> = [];
  const notes: Array<{ id: string; targetId: string; content: string }> = [];
  const savedGraphs: Array<{ id: string; rootEntityId: string; title: string; depth: number }> = [];
  const preferences = {
    userId: user.id,
    theme: "system",
    interfaceLanguage: "en",
    defaultGraphDepth: 3,
    graphLayout: "hierarchical",
    showMeanings: true,
    showSources: true,
    updatedAt: now(),
  };

  const json = (route: any, status: number, body: unknown) =>
    route.fulfill({
      status,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      },
      body: JSON.stringify(body),
    });

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
      });
      return;
    }

    if (path === "/v1/auth/register" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}");
      user.email = body.email;
      user.displayName = body.displayName ?? "E2E Explorer";
      await json(route, 201, {
        user,
        session: {
          accessToken: "mock-e2e-token",
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      });
      return;
    }

    if (path === "/v1/auth/logout" && method === "POST") {
      await route.fulfill({ status: 204 });
      return;
    }

    if (path === "/v1/me" && method === "GET") {
      await json(route, 200, user);
      return;
    }

    if (path === "/v1/search" && method === "GET") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const results = q === "father"
        ? [{
            id: "d694f27c-633c-44a9-a881-130b223b1120",
            wordId: "d694f27c-633c-44a9-a881-130b223b1120",
            type: "word",
            text: "father",
            textOriginal: "father",
            textNormalized: "father",
            language: "English",
            languageFamily: "Germanic",
            stage: "Modern English",
            isReconstructed: false,
            match: { type: "exact", score: 1 },
          }]
        : [];
      await json(route, 200, {
        query: q,
        total: results.length,
        filters: { language: null, family: null, type: null },
        results,
        metadata: { total: results.length, executionTimeMs: 1 },
      });
      return;
    }

    if (path.startsWith("/v1/graph/") && method === "GET") {
      await json(route, 200, { wordId: "d694f27c-633c-44a9-a881-130b223b1120", depth: 3, edges: [] });
      return;
    }

    if (path.startsWith("/v1/words/") && method === "GET") {
      await json(route, 200, {
        wordId: "d694f27c-633c-44a9-a881-130b223b1120",
        textOriginal: "father",
        textNormalized: "father",
        language: "English",
        stage: "Modern English",
        meanings: [{ gloss: "Mock meaning" }],
        sources: [{ title: "Mock Source", sourceLocator: "mock:1" }],
      });
      return;
    }

    if (path === "/v1/me/workspace-summary" && method === "GET") {
      await json(route, 200, {
        savedWords: savedWords.length,
        savedGraphs: savedGraphs.length,
        collections: collections.length,
        notes: notes.length,
        recent: [],
      });
      return;
    }

    if (path === "/v1/me/saved-words" && method === "GET") {
      await json(route, 200, { items: savedWords, nextCursor: null });
      return;
    }

    if (path === "/v1/me/saved-words" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}");
      const wordId = body.wordId as string;
      const existing = savedWords.find((item) => item.wordId === wordId);
      if (existing) {
        await json(route, 200, existing);
        return;
      }
      const row = { id: `saved-${savedWords.length + 1}`, wordId, textOriginal: "father", language: "English" };
      savedWords.push(row);
      await json(route, 200, row);
      return;
    }

    if (path === "/v1/me/collections" && method === "GET") {
      await json(route, 200, collections);
      return;
    }

    if (path === "/v1/me/collections" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}");
      const row = {
        id: `collection-${collections.length + 1}`,
        name: body.name as string,
        description: (body.description as string | null) ?? null,
        position: collections.length,
      };
      collections.push(row);
      await json(route, 201, row);
      return;
    }

    if (path.match(/^\/v1\/me\/collections\/[^/]+\/items$/) && method === "POST") {
      await route.fulfill({ status: 204 });
      return;
    }

    if (path === "/v1/me/notes" && method === "GET") {
      await json(route, 200, { items: notes, nextCursor: null });
      return;
    }

    if (path === "/v1/me/notes" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}");
      const row = { id: `note-${notes.length + 1}`, targetId: body.targetId as string, content: body.content as string };
      notes.unshift(row);
      await json(route, 201, row);
      return;
    }

    if (path === "/v1/me/saved-graphs" && method === "GET") {
      await json(route, 200, { items: savedGraphs, nextCursor: null });
      return;
    }

    if (path === "/v1/me/saved-graphs" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}");
      const row = {
        id: `graph-${savedGraphs.length + 1}`,
        rootEntityId: body.rootEntityId as string,
        title: body.title as string,
        depth: Number(body.depth ?? 3),
      };
      savedGraphs.unshift(row);
      await json(route, 201, row);
      return;
    }

    if (path === "/v1/me/preferences" && method === "GET") {
      await json(route, 200, preferences);
      return;
    }

    if (path === "/v1/me/export" && method === "GET") {
      await json(route, 200, {
        version: 1,
        exportedAt: now(),
        savedWords,
        collections,
        notes,
        savedGraphs,
        preferences,
      });
      return;
    }

    await json(route, 404, { error: { code: "NOT_FOUND", message: `Unhandled mock route: ${method} ${path}` } });
  });
}

test.describe("Critical user journey", () => {
  test("registers, explores, saves workspace artifacts, and exports", async ({ page }) => {
    test.setTimeout(90_000);
    await setupMockApi(page);

    const email = uniqueEmail();
    const password = "LexGraphE2E!123";

    await page.goto("/auth");

    const registerResponsePromise = page.waitForResponse((response) => {
      try {
        const url = new URL(response.url());
        return url.pathname === "/v1/auth/register";
      } catch {
        return false;
      }
    });

    await page.getByTestId("auth-display-name-input").fill("E2E Explorer");
    await page.getByTestId("auth-email-input").fill(email);
    await page.getByTestId("auth-password-input").fill(password);
    await page.getByTestId("auth-submit-button").click();

    const registerResponse = await registerResponsePromise;
    expect(registerResponse.ok()).toBeTruthy();

    await page.waitForURL(/\/workspace/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Workspace", exact: true })).toBeVisible();
    await expect(page.getByTestId("workspace-notebook-panel")).toBeVisible();

    const searchResponsePromise = page.waitForResponse((response) => {
      try {
        const url = new URL(response.url());
        return url.pathname === "/v1/search" && url.searchParams.get("q") === "father";
      } catch {
        return false;
      }
    });

    const searchInput = page.getByPlaceholder("Search words, languages, roots, or meanings...").first();
    await searchInput.fill("father");
    const fatherItem = page.locator("[cmdk-item]").filter({ hasText: /^father/i }).first();
    await expect(fatherItem).toBeVisible();
    await fatherItem.click();

    const searchResponse = await searchResponsePromise;
    expect(searchResponse.ok()).toBeTruthy();

    await page.waitForURL(/\/workspace\?word=father&wordId=.+/);

    await page.getByTestId("workspace-save-word-button").click();
    await expect(page.getByTestId("workspace-saved-words-list")).toContainText("father");

    await page.getByTestId("workspace-collection-name-input").fill("Core lineage");
    await page.getByTestId("workspace-collection-description-input").fill("Critical journey collection");
    await page.getByTestId("workspace-create-collection-button").click();
    await expect(page.getByTestId("workspace-collections-list")).toContainText("Core lineage");

    await page.getByTestId("workspace-collection-select").selectOption({ label: "Core lineage" });
    await page.getByTestId("workspace-add-to-collection-button").click();

    await page.getByTestId("workspace-note-textarea").fill("Father root validated in journey.");
    await page.getByTestId("workspace-save-note-button").click();
    await expect(page.getByTestId("workspace-notes-list")).toContainText("Father root validated in journey.");

    await page.getByTestId("workspace-save-graph-button").click();
    await expect(page.getByTestId("workspace-graphs-list")).toContainText("father - Etymological Lineage");

    await page.goto("/workspace/settings");
    await expect(page.getByTestId("workspace-settings-page")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("settings-export-button").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain("lexgraph-workspace-");
    expect(download.suggestedFilename().endsWith(".json")).toBeTruthy();
  });
});
