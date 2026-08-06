import { WorkspaceSearch } from "@/features/workspace/components/WorkspaceSearch";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

const FEATURED_EXAMPLES = [
  { word: "father", label: "father" },
  { word: "mother", label: "mother" },
  { word: "daughter", label: "daughter" },
  { word: "earth", label: "earth" },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="lex-shell flex items-center justify-between rounded-[var(--radius-2xl)] px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">LexGraph</p>
            <p className="text-sm text-muted-foreground">Explore the history of every word.</p>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <span className="lex-chip">Search</span>
            <span className="lex-chip">Workspace</span>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="max-w-2xl space-y-8">
            <div className="space-y-5">
              <p className="lex-chip uppercase tracking-[0.28em] text-[0.68rem]">
                Graph Workspace Foundation
              </p>
              <div className="space-y-4">
                <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                  Explore the history of every word.
                </h1>
                <p className="max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
                  Search a word and travel through its ancestry graph without leaving the workspace.
                  Select nodes, inspect details, and keep context while you explore.
                </p>
              </div>
            </div>

            <WorkspaceSearch
              mode="hero"
              autoFocus
              placeholder="Search for a word, language, or variant..."
            />

            <div className="flex flex-wrap gap-3">
              {FEATURED_EXAMPLES.map((example) => (
                <a
                  key={example.word}
                  href={`/workspace?word=${encodeURIComponent(example.word)}`}
                  className="lex-chip px-4 py-2 text-sm text-foreground transition-colors hover:border-white/20 hover:bg-white/10"
                >
                  {example.label}
                </a>
              ))}
            </div>
          </div>

          <aside className="lex-panel relative overflow-hidden rounded-[var(--radius-3xl)] p-6">
            <div className="absolute inset-0 rounded-[var(--radius-3xl)] bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(84,132,255,0.12),transparent_32%)]" />
            <div className="relative space-y-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Workspace preview</p>
                <h2 className="text-2xl font-semibold text-foreground">One surface for search, graph, and inspection.</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Persistent search", "Search never leaves the workspace."],
                  ["Interactive graph", "Pan, zoom, fit, and expand branches."],
                  ["Inspector panel", "View language, timeline, and sources instantly."],
                  ["Mobile ready", "Inspector collapses into a focused layout."],
                ].map(([title, body]) => (
                  <div key={title} className="lex-card rounded-[var(--radius-2xl)] p-4">
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>

              <div className="lex-card rounded-[var(--radius-2xl)] p-4 text-sm leading-6 text-muted-foreground">
                The workspace is the application. Search any word, enter the graph, inspect the node, and keep moving through language without unnecessary navigation.
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
