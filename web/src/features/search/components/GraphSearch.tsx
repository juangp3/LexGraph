"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setHighlightedNodeIds, clearHighlights, useSearchStore } from "../stores/searchStore";

interface GraphNode {
  id: string;
  label: string;
  language?: string;
}

interface GraphSearchProps {
  nodes: GraphNode[];
  onHighlight?: (nodeIds: Set<string>) => void;
  className?: string;
}

export function GraphSearch({ nodes, onHighlight, className = "" }: GraphSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (!value.trim()) {
        clearHighlights();
        onHighlight?.(new Set());
        return;
      }

      const lower = value.toLowerCase();
      const matched = new Set(
        nodes
          .filter(
            (n) =>
              n.label.toLowerCase().includes(lower) ||
              n.language?.toLowerCase().includes(lower)
          )
          .map((n) => n.id)
      );

      setHighlightedNodeIds(matched);
      onHighlight?.(matched);
    },
    [nodes, onHighlight]
  );

  useEffect(() => {
    return () => clearHighlights();
  }, []);

  const { highlightedNodeIds } = useSearchStore();
  const matchCount = highlightedNodeIds.size;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Find in graph..."
          aria-label="Search within graph"
          className="h-8 w-full rounded-lg border border-border/60 bg-background/80 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      {query.trim() && (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {matchCount} {matchCount === 1 ? "match" : "matches"}
        </span>
      )}
    </div>
  );
}
