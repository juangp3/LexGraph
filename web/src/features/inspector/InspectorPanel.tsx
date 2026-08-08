import React from 'react';
import { useWordDetails } from './useWordDetails';
import Breadcrumb from './Breadcrumb';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

interface InspectorPanelProps {
  word: string | null;
  wordId?: string | null;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ word, wordId }) => {
  const { data, isLoading, isError } = useWordDetails(wordId);
  const showToast = useToast();

  const handleCopyLink = async () => {
    if (!word) return;
    await navigator.clipboard.writeText(window.location.href);
    showToast({ title: 'Copied link', description: 'The current workspace URL is now on your clipboard.' });
  };

  return (
    <section className="lex-card rounded-[var(--radius-2xl)] p-5" aria-label="Inspector panel">
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-24 w-full" />
            <p className="text-sm text-muted-foreground">Loading metadata...</p>
          </div>
        ) : null}
        {isError ? <div className="text-sm text-muted-foreground">Unable to fetch metadata.</div> : null}
        {!isLoading && !isError && !data ? (
          <div className="text-sm text-muted-foreground">Select a node to inspect metadata.</div>
        ) : null}

        {data ? (
          <>
            <div className="space-y-3">
              <Breadcrumb ancestry={data.ancestry} />
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{data.word}</h2>
                <p className="text-sm text-muted-foreground">{data.language}</p>
              </div>
            </div>

            <div className="grid gap-4">
              <section className="rounded-[var(--radius-xl)] border border-border/60 bg-background/40 p-4">
                <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Summary</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{data.meaning}</p>
              </section>
              <section className="rounded-[var(--radius-xl)] border border-border/60 bg-background/40 p-4">
                <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Timeline</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{data.timeline}</p>
              </section>
              <section className="rounded-[var(--radius-xl)] border border-border/60 bg-background/40 p-4">
                <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Relationships</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  {data.ancestry.length} ancestral steps available in this reading path.
                </p>
              </section>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">References</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {data.sources.map((source) => (
                  <li
                    key={source}
                    className="rounded-[var(--radius-lg)] border border-border/50 bg-background/35 px-3 py-2"
                  >
                    {source}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyLink()}>
                Copy Link
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!wordId) return;
                  window.dispatchEvent(new CustomEvent('lexgraph:centerNode', { detail: { nodeId: wordId } }));
                }}
                disabled={!wordId}
              >
                Center Graph
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
};

export default InspectorPanel;
