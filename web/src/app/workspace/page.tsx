"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import InspectorPanel from "@/features/inspector/InspectorPanel";
import { GraphCanvas } from "@/features/graph/GraphCanvas";
import { WorkspaceSearch } from "@/features/workspace/components/WorkspaceSearch";
import { WorkspaceBreadcrumb } from "@/features/workspace/components/WorkspaceBreadcrumb";
import { WorkspaceTimeline } from "@/features/workspace/components/WorkspaceTimeline";
import { WorkspaceGraphControls } from "@/features/workspace/components/WorkspaceGraphControls";
import { useWorkspaceSearchFocus } from '@/features/workspace/components/WorkspaceSearch';
import { WorkspaceFilters } from "@/features/workspace/components/WorkspaceFilters";
import { WorkspaceStatusBar } from "@/features/workspace/components/WorkspaceStatusBar";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useState } from "react";
import Link from "next/link";
import { AuthMenu } from "@/features/auth/components/AuthMenu";
import { WorkspaceNotebookPanel } from "@/features/workspace/components/WorkspaceNotebookPanel";
import { useAuthSession } from "@/features/auth/auth-session";

import { ReactFlowProvider } from "reactflow";

function Workspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const selectedWordText = searchParams.get("word");
  const selectedNodeId = searchParams.get("wordId") ?? searchParams.get("id") ?? selectedWordText;
  const selectedWord = useMemo(() => selectedWordText ?? selectedNodeId, [selectedNodeId, selectedWordText]);
  const auth = useAuthSession();
  const authHref = useMemo(() => {
    const query = searchParams.toString();
    const nextPath = `/workspace${query ? `?${query}` : ""}`;
    return `/auth?next=${encodeURIComponent(nextPath)}`;
  }, [searchParams]);

  const handleSelectNode = (nodeId: string, label: string) => {
    router.replace(
      `/workspace?word=${encodeURIComponent(label)}&wordId=${encodeURIComponent(nodeId)}`,
      { scroll: false }
    );
  };

  useWorkspaceSearchFocus();
  return (
    <ReactFlowProvider>
      <div className="grid min-h-screen grid-rows-[auto_auto_1fr_auto] bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_auto_1fr_auto]">
        <header className="lex-shell col-span-2 flex items-center justify-between gap-4 rounded-none border-x-0 border-t-0 px-4 py-4 xl:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">LexGraph</p>
            <h1 className="text-lg font-semibold tracking-tight">Workspace</h1>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Link href="/workspace/settings" className="inline-flex">
              <Button type="button" variant="outline" size="sm">
                Settings
              </Button>
            </Link>
            <AuthMenu />
            <ThemeToggle />
            <span className="rounded-full border border-border/70 px-3 py-1">Cmd+K search</span>
            <span className="rounded-full border border-border/70 px-3 py-1">React Flow</span>
          </div>
        </header>

        <div className="col-span-2 border-b border-border/60 px-4 py-4 lg:px-6">
          <WorkspaceSearch navigationMode="replace" placeholder="Search words, languages, roots, or meanings..." />
          <div className="mt-3">
            <WorkspaceBreadcrumb />
          </div>
          <div className="mt-3 flex gap-2 lg:hidden">
            <Button type="button" variant="outline" size="sm" onClick={() => setMobileDrawerOpen(true)}>
              Open details
            </Button>
          </div>
          <Drawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
            <DrawerContent>
              <div className="space-y-4 pt-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Workspace details</p>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">Inspector and filters</h2>
                </div>
                <WorkspaceFilters />
                <InspectorPanel word={selectedWord} wordId={selectedNodeId} />
              </div>
            </DrawerContent>
          </Drawer>
        </div>

        <div className="relative overflow-hidden border-border/60 lg:border-r">
          {!auth.isAuthenticated ? (
            <div className="absolute inset-x-3 top-3 z-20 rounded-xl border border-border/70 bg-background/95 p-3 text-sm text-foreground shadow-[var(--shadow-raised)] backdrop-blur">
              Save, collections, notes, and export require authentication.
              <Link href={authHref} className="ml-2 inline-flex text-primary underline underline-offset-2">Sign in</Link>
            </div>
          ) : null}
          <GraphCanvas
            key={selectedNodeId ?? "empty"}
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

        <div className="lex-panel hidden flex-col gap-4 overflow-y-auto border-t border-border/60 p-4 lg:flex lg:border-t-0 lg:p-6">
          <WorkspaceFilters />
          <InspectorPanel word={selectedWord} wordId={selectedNodeId} />
          {auth.isAuthenticated ? (
            <WorkspaceNotebookPanel
              selectedWordId={selectedNodeId}
              selectedWordText={selectedWordText}
              onOpenWord={handleSelectNode}
            />
          ) : (
            <section className="lex-card rounded-[var(--radius-2xl)] p-4">
              <h2 className="text-lg font-semibold">Sign in to save your research</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Collections, notes, saved graphs, and export are available for authenticated users.
              </p>
              <Link href={authHref} className="mt-3 inline-flex">
                <Button type="button">Go to sign in</Button>
              </Link>
            </section>
          )}
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
