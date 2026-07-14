"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import InspectorPanel from "@/features/inspector/InspectorPanel";

function Workspace() {
  const searchParams = useSearchParams();
  const selectedFromUrl = searchParams.get("word") ?? searchParams.get("wordId");
  const [selectedWord, setSelectedWord] = useState<string | null>(selectedFromUrl);

  useEffect(() => {
    setSelectedWord(selectedFromUrl);
  }, [selectedFromUrl]);

  const graphNodes = useMemo(() => {
    const base = ["father", "mother", "brother", "daughter", "ancestor"];
    if (selectedFromUrl && !base.includes(selectedFromUrl)) {
      return [selectedFromUrl, ...base];
    }
    return base;
  }, [selectedFromUrl]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6" key={selectedFromUrl ?? "empty"}>
      <h1 className="text-2xl font-bold">Workspace</h1>

      <section className="rounded-xl border border-border/80 bg-card p-4" aria-label="Graph workspace">
        <h2 className="text-sm uppercase text-muted-foreground">Graph Nodes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Click a node to inspect metadata without leaving this page.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {graphNodes.map((node) => (
            <button
              key={node}
              type="button"
              onClick={() => setSelectedWord(node)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                selectedWord === node
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {node}
            </button>
          ))}
        </div>
      </section>

      <InspectorPanel word={selectedWord} />
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Workspace />
    </Suspense>
  );
}
