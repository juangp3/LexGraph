"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import InspectorPanel from "@/features/inspector/InspectorPanel";
import { GraphCanvas } from "@/features/graph/GraphCanvas";
import { WorkspaceSearch } from "@/features/workspace/components/WorkspaceSearch";
import { WorkspaceBreadcrumb } from "@/features/workspace/components/WorkspaceBreadcrumb";
import { WorkspaceTimeline } from "@/features/workspace/components/WorkspaceTimeline";
import { WorkspaceGraphControls } from "@/features/workspace/components/WorkspaceGraphControls";
import { WorkspaceFilters } from "@/features/workspace/components/WorkspaceFilters";
import { WorkspaceStatusBar } from "@/features/workspace/components/WorkspaceStatusBar";

import { ReactFlowProvider } from "reactflow";

function Workspace() {
  const searchParams = useSearchParams();
  const initialWord = searchParams.get("word") || "home";
  const initialWordId = searchParams.get("id") || "home";

  const [selectedWord, setSelectedWord] = useState<string | null>(initialWordId ?? initialWord);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialWordId);

  useEffect(() => {
    setSelectedWord(initialWordId ?? initialWord);
    setSelectedNodeId(initialWordId);
  }, [initialWord, initialWordId]);

  return (
    <ReactFlowProvider>
      <div className="grid h-full grid-cols-[1fr_350px] grid-rows-[auto_1fr_auto]">
        <div className="col-span-2 border-b p-4">
          <WorkspaceSearch />
          <WorkspaceBreadcrumb />
        </div>

        <div className="relative row-start-2 overflow-hidden border-r">
          <GraphCanvas
            rootWordId={selectedNodeId}
            rootWordText={initialWord}
            selectedNodeId={selectedNodeId}
            onSelectNode={(nodeId, label) => {
              setSelectedNodeId(nodeId);
              setSelectedWord(nodeId);
            }}
          />
          <div className="absolute bottom-4 left-4">
            <WorkspaceTimeline />
          </div>
          <div className="absolute right-4 top-4">
            <WorkspaceGraphControls />
          </div>
        </div>

        <div className="row-start-2 flex flex-col gap-4 overflow-y-auto p-4">
          <WorkspaceFilters />
          <InspectorPanel word={selectedWord} />
        </div>

        <div className="col-span-2 row-start-3 border-t">
          <WorkspaceStatusBar />
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Workspace />
    </Suspense>
  );
}
