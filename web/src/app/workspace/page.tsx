"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import InspectorPanel from "@/features/inspector/InspectorPanel";
import { GraphCanvas } from "@/features/graph/GraphCanvas";

function Workspace() {
  const searchParams = useSearchParams();
  const initialWord = searchParams.get("word") ?? searchParams.get("wordId");
  const initialWordId = searchParams.get("wordId");

  const [selectedWord, setSelectedWord] = useState<string | null>(
    initialWordId ?? initialWord
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialWordId);

  useEffect(() => {
    setSelectedWord(initialWordId ?? initialWord);
    setSelectedNodeId(initialWordId);
  }, [initialWord, initialWordId]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6" key={initialWordId ?? initialWord ?? "empty"}>
      <h1 className="text-2xl font-bold">Workspace</h1>

      <GraphCanvas
        rootWordId={selectedNodeId}
        selectedNodeId={selectedNodeId}
        onSelectNode={(nodeId, label) => {
          setSelectedNodeId(nodeId);
          setSelectedWord(nodeId);
        }}
      />

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
