'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { searchWords, type SearchResult } from '@/features/search/search.service';
import { highlightMatch } from '@/features/search/highlight';
import { EntityTypeBadge } from '@/features/search/components/EntityTypeBadge';
import { useSearchHistory } from '@/features/search/hooks/useSearchHistory';
import type { SearchEntityType } from '@/features/search/types/search';

interface WorkspaceSearchProps {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  navigationMode?: 'push' | 'replace';
  mode?: 'hero' | 'compact';
}

function useDebouncedValue(value: string, delay = 180) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function buildWorkspaceUrl(result: SearchResult) {
  return `/workspace?word=${encodeURIComponent(result.textOriginal)}&wordId=${encodeURIComponent(result.wordId)}`;
}

function groupByType(results: SearchResult[]): Record<SearchEntityType, SearchResult[]> {
  const groups: Record<SearchEntityType, SearchResult[]> = {
    word: [],
    root: [],
    language: [],
    family: [],
  };
  for (const r of results) {
    groups[r.type]?.push(r);
  }
  return groups;
}

const GROUP_LABELS: Record<SearchEntityType, string> = {
  word: 'Words',
  root: 'Roots',
  language: 'Languages',
  family: 'Language Families',
};

export function WorkspaceSearch({
  className,
  placeholder = 'Search words, languages, roots, or meanings...',
  autoFocus = false,
  navigationMode = 'push',
  mode = 'compact',
}: WorkspaceSearchProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const debouncedQuery = useDebouncedValue(query);
  const { history, addEntry, removeEntry } = useSearchHistory();

  const { data = [], isFetching, isError } = useQuery<SearchResult[]>({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchWords(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 1,
    staleTime: 30_000,
  });

  const hasResults = data.length > 0;
  const showHistory = query.trim().length === 0 && history.length > 0;

  const wrapperClassName = useMemo(
    () =>
      cn(
        'lex-panel w-full overflow-hidden rounded-[var(--radius-2xl)]',
        mode === 'hero' && 'border-border/80 bg-background/90 p-1',
        className
      ),
    [className, mode]
  );

  const navigateToResult = (result: SearchResult) => {
    addEntry(result);
    const targetUrl = buildWorkspaceUrl(result);
    setQuery('');
    if (navigationMode === 'replace') {
      router.replace(targetUrl, { scroll: false });
      return;
    }
    router.push(targetUrl, { scroll: false });
  };

  const groups = useMemo(() => groupByType(data), [data]);
  const firstResult = data[0];

  return (
    <div className={wrapperClassName}>
      <Command
        className="bg-transparent p-0"
        filter={() => 1} // disable built-in filter — server drives results
      >
        <div className={mode === 'hero' ? 'p-3' : 'p-2'}>
          <CommandInput
            placeholder={placeholder}
            value={query}
            autoFocus={autoFocus}
            id="workspace-search-input"
            onValueChange={setQuery}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && firstResult) {
                event.preventDefault();
                navigateToResult(firstResult);
              }
            }}
            className={cn(
              'lex-focus-ring h-12 rounded-xl border-0 bg-transparent text-base shadow-none focus-visible:ring-0',
              mode === 'hero' && 'h-14 text-lg'
            )}
          />
        </div>

        <CommandList className={cn('max-h-96 overflow-y-auto px-2 pb-2', mode === 'compact' && 'pb-1')}>
          {/* Loading state */}
          {isFetching && (
            <CommandEmpty>
              <span className="text-muted-foreground">Searching...</span>
            </CommandEmpty>
          )}

          {/* Empty query — show search history */}
          {!isFetching && showHistory && (
            <CommandGroup heading="Recent searches">
              {history.slice(0, 8).map((entry) => (
                <CommandItem
                  key={entry.wordId}
                  value={`history-${entry.wordId}`}
                  onSelect={() =>
                    navigateToResult({
                      id: entry.id,
                      wordId: entry.wordId,
                      textOriginal: entry.text,
                      text: entry.text,
                      type: entry.type as SearchEntityType,
                      language: entry.language,
                      languageFamily: null,
                      stage: null,
                      isReconstructed: false,
                      match: { type: 'exact', score: 1 },
                    })
                  }
                  className="group justify-between"
                >
                  <span className="text-sm text-foreground">{entry.text}</span>
                  <div className="flex items-center gap-2">
                    {entry.language && (
                      <span className="text-xs text-muted-foreground">{entry.language}</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEntry(entry.wordId);
                      }}
                      className="hidden text-xs text-muted-foreground/50 hover:text-muted-foreground group-hover:inline"
                      aria-label={`Remove ${entry.text} from history`}
                    >
                      ✕
                    </button>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Empty query, no history */}
          {!isFetching && query.trim().length === 0 && history.length === 0 && (
            <CommandEmpty>
              <span className="text-muted-foreground">
                Search words, languages, roots, or meanings.
              </span>
            </CommandEmpty>
          )}

          {/* No results */}
          {!isFetching && query.trim().length > 0 && !hasResults && !isError && (
            <CommandEmpty>
              <div className="space-y-1 text-left">
                <p className="text-sm text-muted-foreground">No results for &quot;{query}&quot;</p>
                <ul className="ml-1 space-y-0.5 text-xs text-muted-foreground/70">
                  <li>• Try fewer characters</li>
                  <li>• Check spelling</li>
                  <li>• Search a related meaning</li>
                </ul>
              </div>
            </CommandEmpty>
          )}

          {/* Error state */}
          {isError && (
            <CommandEmpty>
              <span className="text-muted-foreground">Search temporarily unavailable. Try again.</span>
            </CommandEmpty>
          )}

          {/* Results grouped by entity type */}
          {hasResults &&
            (Object.entries(groups) as [SearchEntityType, SearchResult[]][])
              .filter(([, items]) => items.length > 0)
              .map(([type, items]) => (
                <CommandGroup key={type} heading={GROUP_LABELS[type]}>
                  {items.map((result) => (
                    <CommandItem
                      key={result.wordId}
                      value={`${result.textOriginal} ${result.language ?? ''} ${result.wordId}`}
                      onSelect={() => navigateToResult(result)}
                      className="justify-between gap-3"
                    >
                      <span className="font-medium text-foreground">
                        {highlightMatch(result.textOriginal, query)}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        {result.language && (
                          <span className="text-xs text-muted-foreground">
                            {result.language}
                            {result.languageFamily ? ` · ${result.languageFamily}` : ''}
                          </span>
                        )}
                        <EntityTypeBadge type={result.type} stage={result.stage} />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
        </CommandList>
      </Command>
    </div>
  );
}

// focus search when requested by keyboard shortcut or global event
// listen to custom event 'lexgraph:focusSearch'
export function useWorkspaceSearchFocus() {
  useEffect(() => {
    const handler = () => {
      const el = document.getElementById('workspace-search-input') as HTMLInputElement | null;
      if (el) el.focus();
    };
    window.addEventListener('lexgraph:focusSearch', handler as EventListener);
    return () => window.removeEventListener('lexgraph:focusSearch', handler as EventListener);
  }, []);
}

