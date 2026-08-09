"use client";

import * as React from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { searchWords, type SearchResult } from "@/features/search/search.service";
import { highlightMatch } from "@/features/search/highlight";
import { EntityTypeBadge } from "@/features/search/components/EntityTypeBadge";
import { useSearchHistory } from "@/features/search/hooks/useSearchHistory";
import type { SearchEntityType } from "./types/search";

const GROUP_ORDER: SearchEntityType[] = ["word", "root", "language", "family"];
const GROUP_LABELS: Record<SearchEntityType, string> = {
  word: "Words",
  root: "Roots",
  language: "Languages",
  family: "Language Families",
};

function useDebouncedValue(value: string, delay = 200) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

export function CommandSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const debouncedQuery = useDebouncedValue(query);
  const { history, addEntry } = useSearchHistory();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: searchResults = [], isFetching } = useQuery<SearchResult[]>({
    queryKey: ["cmd-search", debouncedQuery],
    queryFn: ({ signal }) => searchWords(debouncedQuery, {}, signal),
    enabled: debouncedQuery.trim().length >= 1,
    staleTime: 30_000,
  });

  const grouped = React.useMemo(() => {
    const map: Partial<Record<SearchEntityType, SearchResult[]>> = {};
    for (const r of searchResults) {
      if (!map[r.type]) map[r.type] = [];
      map[r.type]!.push(r);
    }
    return map;
  }, [searchResults]);

  const runCommand = React.useCallback(
    (result: SearchResult) => {
      addEntry(result);
      setOpen(false);
      setQuery("");
      router.push(
        `/workspace?word=${encodeURIComponent(result.textOriginal)}&wordId=${encodeURIComponent(result.wordId)}`
      );
    },
    [addEntry, router]
  );

  const showHistory = query.trim().length === 0 && history.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open search"
        className="lex-shell lex-focus-ring flex h-11 w-64 items-center justify-between gap-3 rounded-[var(--radius-2xl)] px-3 text-left text-sm text-muted-foreground"
      >
        <span>Search words, languages, roots...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border/70 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command filter={() => 1}>
          <CommandInput
            placeholder="Search words, languages, roots, or meanings..."
            value={query}
            onValueChange={setQuery}
            className="lex-focus-ring"
          />
          <CommandList>
            {isFetching && <CommandEmpty>Searching...</CommandEmpty>}

            {!isFetching && showHistory && (
              <CommandGroup heading="Recent">
                {history.slice(0, 6).map((entry) => (
                  <CommandItem
                    key={`hist-${entry.wordId}`}
                    value={`hist-${entry.wordId}`}
                    onSelect={() =>
                      runCommand({
                        id: entry.id,
                        wordId: entry.wordId,
                        textOriginal: entry.text,
                        text: entry.text,
                        type: entry.type as SearchEntityType,
                        language: entry.language,
                        languageFamily: null,
                        stage: null,
                        isReconstructed: false,
                        match: { type: "exact", score: 1 },
                      })
                    }
                  >
                    <span>{entry.text}</span>
                    {entry.language && (
                      <span className="ml-2 text-xs text-muted-foreground">{entry.language}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!isFetching && query.trim().length > 0 && searchResults.length === 0 && (
              <CommandEmpty>No results for &quot;{query}&quot;.</CommandEmpty>
            )}

            {!isFetching &&
              query.trim().length === 0 &&
              history.length === 0 && (
                <CommandEmpty>
                  Start typing to search across LexGraph.
                </CommandEmpty>
              )}

            {GROUP_ORDER.filter((t) => (grouped[t]?.length ?? 0) > 0).map((type, idx) => (
              <React.Fragment key={type}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup heading={GROUP_LABELS[type]}>
                  {grouped[type]!.map((result) => (
                    <CommandItem
                      key={result.wordId}
                      value={`${result.textOriginal}-${result.wordId}`}
                      onSelect={() => runCommand(result)}
                    >
                      <span className="flex-1">
                        {highlightMatch(result.textOriginal, query)}
                      </span>
                      <div className="flex items-center gap-2">
                        {result.language && (
                          <span className="text-xs text-muted-foreground">
                            {result.language}
                          </span>
                        )}
                        <EntityTypeBadge type={result.type} stage={result.stage} />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

