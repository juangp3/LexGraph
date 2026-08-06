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
      <h3 className="text-xs uppercase font-medium text-muted-foreground mb-3">Filters</h3>
      <div className="space-y-2.5">
        {FILTERS.map((filter) => (
          <label key={filter.id} className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={relationFilters[filter.id]}
              onChange={() => toggleFilter(filter.id)}
              className="w-4 h-4 rounded border-border bg-background border transition-colors cursor-pointer accent-primary"
              aria-label={`Filter by ${filter.label}`}
            />
            <span className="text-sm text-foreground group-hover:text-primary/80 transition-colors">
              {filter.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
