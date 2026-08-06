"use client";

import { useSearchParams } from "next/navigation";

export function WorkspaceStatusBar() {
  const searchParams = useSearchParams();
  const word = searchParams.get("word") ?? "No word selected";
  const wordId = searchParams.get("wordId") ?? searchParams.get("id");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground lg:px-6">
      <span>Current node: {word}</span>
      <span>{wordId ? `Node ID: ${wordId}` : "Awaiting workspace selection"}</span>
      <span>Workspace ready</span>
    </div>
  );
}
