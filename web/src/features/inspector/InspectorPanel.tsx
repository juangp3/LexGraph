import React from 'react';
import { useWordDetails } from './useWordDetails';
import Breadcrumb from './Breadcrumb';

interface InspectorPanelProps {
  word: string | null;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ word }) => {
  const { data, isLoading, isError } = useWordDetails(word);

  return (
    <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm" aria-label="Inspector panel">
      {isLoading ? <div>Loading metadata...</div> : null}
      {isError ? <div>Unable to fetch metadata.</div> : null}
      {!isLoading && !isError && !data ? <div>Select a node to inspect metadata.</div> : null}

      {data ? (
        <>
      <Breadcrumb ancestry={data.ancestry} />
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">{data.word}</h2>
      <p className="text-sm text-muted-foreground">{data.language}</p>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Meaning</dt>
          <dd className="mt-1 text-sm leading-relaxed">{data.meaning}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">Timeline</dt>
          <dd className="mt-1 text-sm leading-relaxed">{data.timeline}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <h3 className="text-xs uppercase text-muted-foreground">Sources</h3>
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
          {data.sources.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>
      </div>
        </>
      ) : null}
    </section>
  );
};

export default InspectorPanel;
