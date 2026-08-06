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
} from "@/components/ui/command";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { searchWords, type SearchResult } from "@/features/search/search.service";
import { highlightMatch } from "@/features/search/highlight";

export function CommandSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();

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

  const { data: searchResults = [] } = useQuery<SearchResult[]>({
    queryKey: ["search", query],
    queryFn: () => searchWords(query),
    enabled: !!query,
  });

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lex-shell lex-focus-ring flex h-11 w-64 items-center justify-between gap-3 rounded-[var(--radius-2xl)] px-3 text-left text-sm text-muted-foreground"
      >
        <span>Search...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border/70 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command
          filter={(value, search) => {
            const result = searchResults.find((r) => r.wordId === value);
            if (result) {
              return result.textOriginal.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }
            return 0;
          }}
        >
          <CommandInput
            placeholder="Type a word to search..."
            value={query}
            onValueChange={setQuery}
            className="lex-focus-ring"
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Words">
              {searchResults.map((result) => (
                <CommandItem
                  key={result.wordId}
                  value={result.wordId}
                  onSelect={() => {
                    runCommand(() =>
                      router.push(
                        `/workspace?word=${encodeURIComponent(result.textOriginal)}&wordId=${encodeURIComponent(result.wordId)}`
                      )
                    );
                  }}
                >
                  <span>{highlightMatch(result.textOriginal, query)}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {result.language}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
