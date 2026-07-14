# LexGraph UI/Web App Build Plan

## Objective

To create a fast, intuitive, and visually engaging web application that consumes the LexGraph API, allowing users to search for words, explore their details, and visualize their etymological history.

## Proposed Technology Stack

- **Framework:** **Next.js (React)**. This provides an excellent foundation with server-side rendering (for fast initial loads and SEO), a great developer experience, and a robust ecosystem.
- **Language:** **TypeScript**. To maintain type safety and consistency with the backend project.
- **Styling:** **Tailwind CSS**. For rapid, utility-first styling that is highly customizable and maintainable.
- **Data Fetching/State:** **TanStack Query (formerly React Query)**. The perfect tool for fetching, caching, and managing server state from our API.
- **Graph Visualization:** **D3.js** or a higher-level library like **React Flow**. D3 offers maximum power and customizability for creating unique graph visualizations. React Flow is easier to start with and is built for node-based UIs. We would start with React Flow for speed and evaluate D3 if more custom visuals are needed.
- **Deployment:** **Vercel**. As the creators of Next.js, their platform offers seamless, zero-configuration deployment and hosting.

---

## Phased Development Plan (4 Weeks)

This plan assumes a new repository or a new directory (`/webapp`) within the existing monorepo.

### Week 1: Project Setup & Search View

- **Deliverables:**
  - New Next.js project bootstrapped with TypeScript and Tailwind CSS.
  - Basic layout component (header, footer, main content area).
  - A dedicated search page (`/search`).
  - A search input component that fetches data from the `/v1/search` API endpoint as the user types.
  - A results component that displays a list of `SearchCandidate` results, linking to a placeholder word detail page.
- **Acceptance Criteria:**
  - A user can type "father" into the search box and see a list of results from the API.
  - Each result is a clickable link leading to a (currently empty) page like `/words/{wordId}`.
  - The project is deployable to Vercel.

### Week 2: Word Detail View

- **Deliverables:**
  - A dynamic word detail page at `/words/[wordId]`.
  - This page fetches and displays data from the `/v1/words/{wordId}` endpoint.
  - Components to cleanly display the word's text, language, meanings, and source attribution.
  - A "View Lineage" button.
- **Acceptance Criteria:**
  - Navigating to `/words/{some-uuid}` shows the full details for that word.
  - Meanings and sources are displayed in a readable format (e.g., lists or cards).
  - The page handles the "not found" case gracefully if the API returns a 404.

### Week 3: Graph Visualization

- **Deliverables:**
  - A new page at `/graph/{wordId}` or a modal view for displaying the graph.
  - Integration of `React Flow` (or similar library).
  - When the page loads, it calls the `/v1/graph/ancestors/{wordId}` endpoint.
  - The API response is transformed into nodes and edges and rendered as a visual graph.
  - Basic styling for nodes (to show word text) and edges (to show relation type).
- **Acceptance Criteria:**
  - Clicking "View Lineage" from the word detail page navigates to the graph view.
  - A clear, readable graph of the word's ancestry is displayed.
  - The graph layout is automatic and handles a depth of at least 4 levels without overlapping badly.

### Week 4: Interactivity & Polish

- **Deliverables:**
  - **Interactive Graph:** Clicking a node in the graph displays a small pop-up/tooltip with more details about that word. Clicking an edge shows its provenance (source, confidence).
  - **UI Polish:** Add loading states (spinners/skeletons) for all data-fetching views.
  - **Error Handling:** Display user-friendly error messages if the API fails.
  - **Responsive Design:** Ensure the search, detail, and graph views are usable on mobile devices.
- **Acceptance Criteria:**
  - All interactive elements provide immediate visual feedback.
  - The application feels smooth and professional, with no jarring content shifts during loading.
  - The UI does not break on smaller screen sizes.
