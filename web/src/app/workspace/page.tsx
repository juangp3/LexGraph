"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
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
  const router = useRouter();
  const selectedWordText = searchParams.get("word");
  const selectedNodeId = searchParams.get("wordId") ?? searchParams.get("id") ?? selectedWordText;
  const selectedWord = useMemo(() => selectedWordText ?? selectedNodeId, [selectedNodeId, selectedWordText]);

  const handleSelectNode = (nodeId: string, label: string) => {
    router.replace(
      `/workspace?word=${encodeURIComponent(label)}&wordId=${encodeURIComponent(nodeId)}`,
      { scroll: false }
    );
  };

  return (
    <ReactFlowProvider>
      <div className="grid min-h-screen grid-rows-[auto_auto_1fr_auto] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%),linear-gradient(180deg,rgba(10,12,16,1),rgba(7,8,11,1))] text-foreground lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_auto_1fr_auto]">
        <header className="col-span-2 flex items-center justify-between gap-4 border-b border-border/70 px-4 py-4 backdrop-blur xl:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">LexGraph</p>
            <h1 className="text-lg font-semibold tracking-tight">Workspace</h1>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="rounded-full border border-border/70 px-3 py-1">Cmd+K search</span>
            <span className="rounded-full border border-border/70 px-3 py-1">React Flow</span>
          </div>
        </header>

        <div className="col-span-2 border-b border-border/60 px-4 py-4 lg:px-6">
          <WorkspaceSearch navigationMode="replace" placeholder="Search the workspace..." />
          <div className="mt-3">
          <WorkspaceBreadcrumb />
          </div>
        </div>

        <div className="relative overflow-hidden border-border/60 lg:border-r">
          <GraphCanvas
            rootWordId={selectedNodeId}
            rootWordText={selectedWordText}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
          />
          <div className="absolute bottom-4 left-4">
            <WorkspaceTimeline />
          </div>
          <div className="absolute right-4 top-4">
            <WorkspaceGraphControls />
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto border-t border-border/60 bg-card/40 p-4 lg:border-t-0 lg:p-6">
          <WorkspaceFilters />
          <InspectorPanel word={selectedWord} />
        </div>

        <div className="col-span-2 border-t border-border/60 bg-background/70 backdrop-blur">
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
