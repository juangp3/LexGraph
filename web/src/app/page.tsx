import { WorkspaceSearch } from "@/features/workspace/components/WorkspaceSearch";

const FEATURED_EXAMPLES = [
  { word: "father", label: "father" },
  { word: "mother", label: "mother" },
  { word: "daughter", label: "daughter" },
  { word: "earth", label: "earth" },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(138,160,255,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.14),_transparent_28%),linear-gradient(180deg,#0b0f17_0%,#090b10_55%,#07090d_100%)] text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">LexGraph</p>
            <p className="text-sm text-slate-300">Explore the history of every word.</p>
          </div>
          <div className="hidden gap-2 text-xs text-slate-300 md:flex">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Search</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Workspace</span>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="max-w-2xl space-y-8">
            <div className="space-y-5">
              <p className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.28em] text-slate-300">
                Graph Workspace Foundation
              </p>
              <div className="space-y-4">
                <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
                  Explore the history of every word.
                </h1>
                <p className="max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
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
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-colors hover:border-white/20 hover:bg-white/10"
                >
                  {example.label}
                </a>
              ))}
            </div>
          </div>

          <aside className="relative rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)] backdrop-blur">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.14),transparent_32%)]" />
            <div className="relative space-y-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Workspace preview</p>
                <h2 className="text-2xl font-semibold text-white">One surface for search, graph, and inspection.</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Persistent search", "Search never leaves the workspace."],
                  ["Interactive graph", "Pan, zoom, fit, and expand branches."],
                  ["Inspector panel", "View language, timeline, and sources instantly."],
                  ["Mobile ready", "Inspector collapses into a focused layout."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-medium text-white">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-slate-300">
                The workspace is the application. Search any word, enter the graph, inspect the node, and keep moving through language without unnecessary navigation.
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
