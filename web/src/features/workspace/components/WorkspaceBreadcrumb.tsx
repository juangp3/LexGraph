"use client";

import { useSearchParams } from "next/navigation";

export function WorkspaceBreadcrumb() {
  const searchParams = useSearchParams();
  const word = searchParams.get("word");
  const language = searchParams.get("language");

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span className="rounded-full border border-border/70 px-3 py-1">/workspace</span>
      <span>{word ? `Exploring ${word}` : "Search a word to begin"}</span>
      {language ? <span className="rounded-full border border-border/70 px-3 py-1">{language}</span> : null}
    </div>
  );
}
