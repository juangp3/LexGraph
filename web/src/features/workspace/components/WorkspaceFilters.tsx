'use client';

import { useGraphStore } from '@/features/graph/graph.store';
import type { GraphMode } from '@/features/graph/graph.service';

const FILTERS: { id: GraphMode; label: string }[] = [
  { id: 'ancestors', label: 'Ancestors' },
  { id: 'descendants', label: 'Descendants' },
  { id: 'borrowings', label: 'Borrowings' },
  { id: 'cognates', label: 'Cognates' },
];

export function WorkspaceFilters() {
  const { relationFilters, toggleFilter } = useGraphStore();

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm" aria-label="Workspace filters">
      <h3 className="mb-3 text-xs font-medium uppercase text-muted-foreground">Filters</h3>
      <div className="space-y-2.5">
        {FILTERS.map((filter) => (
          <label key={filter.id} className="group flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={relationFilters[filter.id]}
              onChange={() => toggleFilter(filter.id)}
              className="h-4 w-4 cursor-pointer rounded border border-border bg-background transition-colors accent-primary"
              aria-label={`Filter by ${filter.label}`}
            />
            <span className="text-sm text-foreground transition-colors group-hover:text-primary/80">
              {filter.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
