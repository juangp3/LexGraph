'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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

export function WorkspaceSearch({
  className,
  placeholder = 'Search any word...',
  autoFocus = false,
  navigationMode = 'push',
  mode = 'compact',
}: WorkspaceSearchProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const debouncedQuery = useDebouncedValue(query);

  const { data = [], isFetching, isError } = useQuery<SearchResult[]>({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchWords(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
  });

  const hasResults = data.length > 0;
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
    const targetUrl = buildWorkspaceUrl(result);
    setQuery('');
    if (navigationMode === 'replace') {
      router.replace(targetUrl, { scroll: false });
      return;
    }
    router.push(targetUrl, { scroll: false });
  };

  const firstResult = data[0];

  return (
    <div className={wrapperClassName}>
      <Command className="bg-transparent p-0">
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
        <CommandList className={cn('max-h-80 overflow-y-auto px-2 pb-2', mode === 'compact' && 'pb-1')}>
          {isFetching && <CommandEmpty>Searching the archive...</CommandEmpty>}
          {!isFetching && query.trim().length === 0 && (
            <CommandEmpty>Type a word to search the graph workspace.</CommandEmpty>
          )}
          {!isFetching && query.trim().length > 0 && !hasResults && !isError && (
            <CommandEmpty>No matching words found.</CommandEmpty>
          )}
          {isError && <CommandEmpty>Unable to search right now.</CommandEmpty>}
          {hasResults && (
            <CommandGroup heading="Words">
              {data.map((result) => (
                <CommandItem
                  key={result.wordId}
                  value={`${result.textOriginal} ${result.language}`}
                  onSelect={() => navigateToResult(result)}
                  className="justify-between"
                >
                  <span className="font-medium text-foreground">{highlightMatch(result.textOriginal, query)}</span>
                  <span className="text-xs text-muted-foreground">{result.language}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
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
