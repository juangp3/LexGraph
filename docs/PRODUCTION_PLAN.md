# LexGraph: Production Readiness Plan

This document outlines a systematic approach to eliminate all mocks, ensure full integration between the frontend and backend, and validate the application for production deployment.

**Target State:**
- Single source of truth: Backend API only
- Frontend directly calls backend services
- No mock data in production builds
- Environment-driven configuration
- Full test coverage against live backend

---

## Phase 1: Environment & Configuration

### 1.1 Environment Variable Strategy

**Objective:** Standardize API URL configuration across all environments.

**Implementation Steps:**

1.  **Create `.env.example` files** in the root and `web/` directories to document necessary environment variables (`DATABASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, etc.).
2.  **Update Backend CORS**: Modify `src/app.ts` to use a `FRONTEND_URL` environment variable instead of a hardcoded origin.
3.  **Update Docker Compose**: Adjust `docker-compose.yml` to inject environment variables into the `api` and `web` services, ensuring they can communicate within the Docker network (e.g., `NEXT_PUBLIC_API_BASE_URL: http://api:3001`).
4.  **Refactor Web Dockerfile**: Replace the placeholder `docker/web/Dockerfile` with a multi-stage build that correctly builds the Next.js application and serves it.
5.  **Create Build Scripts**: Add helper scripts (`scripts/build.sh`, `scripts/start.sh`) to manage builds and deployments for different environments.

### 1.2 Refactor Frontend Services

**Objective:** Ensure all frontend services read API URLs from environment configuration.

**Implementation Steps:**

1.  **Refactor `inspector.service.ts`**: Change the `getWordDetails` method to call the backend API (`/v1/words/:id`) directly, instead of the Next.js API route (`/api/words/:word`). This is the most critical change to remove a mock-heavy pathway.
2.  **Verify Other Services**: Confirm that `graph.service.ts` and `CommandSearch.tsx` already correctly use `process.env.NEXT_PUBLIC_API_BASE_URL`.

---

## Phase 2: De-Mocking & Full Integration

### 2.1 Disable MSW for Production

**Objective:** Ensure Mock Service Worker is completely disabled in production.

**Implementation Steps:**

1.  **Verify `providers.tsx`**: The current implementation in `web/src/app/providers.tsx` already correctly disables MSW when `process.env.NODE_ENV` is not `development`.
2.  **Add Safety Checks**: Enhance the MSW initialization to log its status (enabled/disabled) and add a runtime error in `web/src/mocks/browser.ts` to prevent it from ever being included in a production bundle.

### 2.2 Remove Mock Data from Production Path

**Objective:** Eliminate all inline mock data and fallback responses.

**Implementation Steps:**

1.  **Delete Next.js API Route**: Remove the file `web/src/app/api/words/[word]/route.ts`. It is no longer needed after refactoring `inspector.service.ts` and contains significant mock data.
2.  **Review MSW Handlers**: The mock data in `web/src/mocks/handlers.ts` can remain as it is only used in development, but it's good practice to add comments clarifying this.

### 2.3 Address Backend API Configuration

**Objective:** Ensure the backend is ready to serve the production frontend.

**Implementation Steps:**

1.  **Flexible CORS**: Update `src/app.ts` with a more robust CORS configuration that can accept multiple origins from environment variables, covering development, staging, and production URLs.
2.  **Request Validation**: Add simple middleware to the backend for logging requests and adding a request ID for better traceability.
3.  **Error Handling**: Implement a global error handling middleware in `src/app.ts` to ensure consistent error responses.

---

## Phase 3: Validation & Hardening

### 3.1 Update and Run E2E Tests

**Objective:** Ensure all features work correctly against the live backend.

**Implementation Steps:**

1.  **Configure Playwright**: Update `web/playwright.config.ts` to manage running the full-stack application (`npm run dev:full`) as a `webServer` for tests.
2.  **Enhance E2E Tests**: Modify existing tests (e.g., `web/tests/search.spec.ts`) to intercept and assert that network requests are being made to the live backend API endpoints (`/v1/*`) and not being handled by MSW or Next.js API routes.
3.  **Create New E2E Tests**: Add new test files (e.g., `graph-traversal.spec.ts`) to cover critical user flows like graph traversal, node selection, and inspector panel updates, again verifying backend communication.
4.  **Run Full Test Suite**: Execute the entire test suite against a seeded, live database.

### 3.2 Manual QA Checklist

**Objective:** Manually verify all features work as expected in a production-like environment.

1.  **Search**: Confirm that searching for a word returns results from the database and navigates to the workspace.
2.  **Graph**: Verify that all graph modes (Ancestors, Descendants, etc.) load data correctly from the backend.
3.  **Inspector**: Ensure that selecting a node in the graph populates the inspector panel with live data.
4.  **Interactivity**: Test lazy loading, node collapsing/expanding, and PNG export.
5.  **Error States**: Manually test scenarios where the backend might be down or return errors to ensure the UI responds gracefully.

#### 3.2 Execution Report (2026-07-16)

Environment:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001` (`/health` returned `{ "ok": true, "service": "lexgraph-api" }`)

Results:
1.  **Search**: **PASS**
	- Opened command search from home page.
	- Queried `father` and navigated to `/workspace?word=father&wordId=...`.
	- Verified request activity to backend `/v1/search` and workspace load.

2.  **Graph**: **PASS**
	- Verified initial ancestors graph load from backend request `/v1/graph/ancestors/:wordId`.
	- Verified additional graph mode data calls:
	  - `/v1/graph/descendants/:wordId`
	  - `/v1/graph/borrowings/:wordId`
	  - `/v1/graph/cognates/:wordId`
	- Confirmed graph renders corresponding edges/nodes after mode actions.

3.  **Inspector**: **PASS**
	- Selected graph nodes and verified inspector panel updates.
	- Confirmed backend word details requests to `/v1/words/:wordId`.

4.  **Interactivity**: **PASS**
	- **Lazy loading**: `Expand Descendants` increased rendered graph from 4 edges/4 nodes baseline to include descendant edge/node.
	- **Collapse/expand**: `Collapse/Expand Branch` collapsed root branch and reduced node count; `Expand All` restored full node set.
	- **PNG export**: `Download PNG` generated a data URL download with filename `lexgraph-father.png`.

5.  **Error States**: **PASS**
	- Simulated backend outage in browser by forcing `/v1/*` fetch failures.
	- Search degraded gracefully to `No results found.` (no crash/hang).
	- Workspace stayed functional with `No graph edges available for current filters.` and inspector displayed `Unable to fetch metadata.`.

### 3.3 Final Production Readiness Checklist

- [x] All mock data and fallback logic removed from the production code path.
- [x] Environment variables are documented and used for all configuration.
- [x] E2E tests pass against the fully integrated application.
- [x] Manual QA has been completed and signed off.
- [x] Production build scripts are finalized and tested.
- [x] The `integrity:check` script runs successfully against the production database.

#### 3.3 Execution Notes (2026-07-16)

- Removed remaining Next.js mock/fallback route from production path: `web/src/app/api/words/[word]/route.ts`.
- Environment documentation completed:
	- Root env template expanded with API/CORS/test variables in `.env.example`.
	- Frontend env template expanded with runtime and E2E toggles in `web/.env.example`.
- Environment-driven runtime config confirmed:
	- Backend CORS now reads `FRONTEND_URL` / `FRONTEND_URLS` in `src/app.ts`.
	- Frontend API URL and MSW toggle read from `NEXT_PUBLIC_*` environment variables.
- Production build validation passed:
	- `npm run build`
	- `npm --prefix web run build`
- Integrity gate passed:
	- `npm run integrity:check` (all checks PASS, `Integrity checks passed.`)
