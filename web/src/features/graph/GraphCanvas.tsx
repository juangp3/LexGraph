"use client";

import { toPng } from 'html-to-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraph } from './useGraph';
import { graphService, mergeFlowGraphs, type FlowGraph, type GraphMode } from './graph.service';
import { useGraphStore } from './graph.store';

const NODE_TYPES = {};
const EDGE_TYPES = {};

interface GraphCanvasProps {
  rootWordId: string | null;
  rootWordText?: string | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string, label: string) => void;
}

function GraphCanvasInner({ rootWordId, rootWordText, selectedNodeId, onSelectNode }: GraphCanvasProps) {
  const { data, isLoading, isError, isFetching, refetch } = useGraph(rootWordId, 6, rootWordText);
  const [overlayGraphs, setOverlayGraphs] = useState<Partial<Record<GraphMode, FlowGraph>>>({});
  const [expandedDescendantGraphs, setExpandedDescendantGraphs] = useState<Record<string, FlowGraph>>({});
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [loadingRelationMode, setLoadingRelationMode] = useState<GraphMode | null>(null);
  const [isExpandingDescendants, setIsExpandingDescendants] = useState(false);
  const { relationFilters, toggleFilter: toggleStoreFilter, resetRelationFilters } = useGraphStore();
  const reactFlow = useReactFlow();
  const graphContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    resetRelationFilters();
    setOverlayGraphs({});
    setExpandedDescendantGraphs({});
    setCollapsedNodeIds(new Set());
  }, [rootWordId, resetRelationFilters]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectNode(node.id, String(node.data?.label ?? node.id));
    },
    [onSelectNode]
  );

  const loadRelationOverlay = useCallback(
    async (mode: Extract<GraphMode, 'borrowings' | 'cognates'>) => {
      if (!rootWordId) return;
      setLoadingRelationMode(mode);
      try {
        const depth = mode === 'cognates' ? 2 : 3;
        const graph = await graphService.fetchTraversalFlow(mode, rootWordId, depth);
        setOverlayGraphs((prev) => ({ ...prev, [mode]: graph }));
      } finally {
        setLoadingRelationMode(null);
      }
    },
    [rootWordId]
  );

  const toggleFilter = useCallback(
    async (mode: GraphMode) => {
      const nextEnabled = !relationFilters[mode];
      toggleStoreFilter(mode);

      if (nextEnabled && (mode === 'borrowings' || mode === 'cognates') && !overlayGraphs[mode]) {
        await loadRelationOverlay(mode);
      }
    },
    [relationFilters, overlayGraphs, loadRelationOverlay, toggleStoreFilter]
  );

  const expandDescendants = useCallback(async () => {
    if (!selectedNodeId || expandedDescendantGraphs[selectedNodeId]) {
      return;
    }
    setIsExpandingDescendants(true);
    try {
      const graph = await graphService.fetchTraversalFlow('descendants', selectedNodeId, 3);
      setExpandedDescendantGraphs((prev) => ({ ...prev, [selectedNodeId]: graph }));
    } finally {
      setIsExpandingDescendants(false);
    }
  }, [selectedNodeId, expandedDescendantGraphs]);

  const collapseSelectedBranch = useCallback(() => {
    if (!selectedNodeId) return;
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(selectedNodeId)) {
        next.delete(selectedNodeId);
      } else {
        next.add(selectedNodeId);
      }
      return next;
    });
  }, [selectedNodeId]);

  const expandAllBranches = useCallback(() => {
    setCollapsedNodeIds(new Set());
  }, []);

  const downloadPng = useCallback(async () => {
    if (!graphContainerRef.current) return;
    const dataUrl = await toPng(graphContainerRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#0b0d10',
    });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `lexgraph-${rootWordText ?? rootWordId ?? 'workspace'}.png`;
    link.click();
  }, [rootWordId, rootWordText]);

  const mergedGraph = useMemo(() => {
    const descendantGraphs = Object.values(expandedDescendantGraphs);
    return mergeFlowGraphs([
      data,
      overlayGraphs.borrowings,
      overlayGraphs.cognates,
      ...descendantGraphs,
    ]);
  }, [data, overlayGraphs.borrowings, overlayGraphs.cognates, expandedDescendantGraphs]);

  const filteredEdges = useMemo(() => {
    return mergedGraph.edges.filter((edge) => {
      const mode = ((edge.data as { mode?: GraphMode } | undefined)?.mode ?? 'ancestors') as GraphMode;
      return relationFilters[mode];
    });
  }, [mergedGraph.edges, relationFilters]);

  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (rootWordId) ids.add(rootWordId);
    if (selectedNodeId) ids.add(selectedNodeId);
    filteredEdges.forEach((edge) => {
      ids.add(edge.source);
      ids.add(edge.target);
    });
    return ids;
  }, [filteredEdges, rootWordId, selectedNodeId]);

  const hiddenDescendants = useMemo(() => {
    if (!collapsedNodeIds.size) {
      return new Set<string>();
    }

    const childrenByNode = new Map<string, string[]>();
    for (const edge of filteredEdges) {
      const current = childrenByNode.get(edge.source) ?? [];
      current.push(edge.target);
      childrenByNode.set(edge.source, current);
    }

    const hidden = new Set<string>();
    for (const collapsedId of collapsedNodeIds) {
      const queue = [...(childrenByNode.get(collapsedId) ?? [])];
      while (queue.length > 0) {
        const next = queue.shift() as string;
        if (hidden.has(next) || collapsedNodeIds.has(next)) continue;
        hidden.add(next);
        queue.push(...(childrenByNode.get(next) ?? []));
      }
    }

    return hidden;
  }, [filteredEdges, collapsedNodeIds]);

  const visibleEdges = useMemo(
    () =>
      filteredEdges.filter(
        (edge) => !hiddenDescendants.has(edge.source) && !hiddenDescendants.has(edge.target)
      ),
    [filteredEdges, hiddenDescendants]
  );

  const visibleNodes = useMemo(() => {
    return mergedGraph.nodes
      .filter((node) => visibleNodeIds.has(node.id) && !hiddenDescendants.has(node.id))
      .map((node) => {
        const isSelected = selectedNodeId === node.id;
        const isCollapsed = collapsedNodeIds.has(node.id);
        return {
          ...node,
          selected: isSelected,
          data: {
            ...(node.data ?? {}),
            label: `${String(node.data?.label ?? node.id)}${isCollapsed ? ' (collapsed)' : ''}`,
          },
          style: {
            ...(node.style ?? {}),
            boxShadow: isSelected ? '0 0 0 2px oklch(0.708 0 0)' : 'none',
          },
        };
      });
  }, [mergedGraph.nodes, visibleNodeIds, hiddenDescendants, selectedNodeId, collapsedNodeIds]);

  useEffect(() => {
    if (!visibleNodes.length) return;
    const id = requestAnimationFrame(() => {
      reactFlow.fitView({ padding: 0.2, duration: 300 });
    });
    return () => cancelAnimationFrame(id);
  }, [visibleNodes.length, visibleEdges.length, reactFlow]);

  const hasGraph = useMemo(() => visibleNodes.length > 0 && visibleEdges.length > 0, [visibleNodes.length, visibleEdges.length]);

  if (!rootWordId) {
    return (
      <section className="rounded-xl border border-border/80 bg-card p-4" aria-label="Graph workspace">
        <h2 className="text-sm uppercase text-muted-foreground">Interactive Graph</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Select a word from search to load its ancestry graph.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="rounded-xl border border-border/80 bg-card p-4" aria-label="Graph workspace">
        <h2 className="text-sm uppercase text-muted-foreground">Interactive Graph</h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading graph...</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="rounded-xl border border-destructive/50 bg-card p-4" aria-label="Graph workspace">
        <h2 className="text-sm uppercase text-muted-foreground">Interactive Graph</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Unable to load graph data for this word.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
        >
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border/80 bg-card p-2" aria-label="Graph workspace">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1">
        <h2 className="text-sm uppercase text-muted-foreground">Interactive Graph</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => reactFlow.fitView({ padding: 0.2 })}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Fit View
          </button>
          <button
            type="button"
            onClick={downloadPng}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Download PNG
          </button>
          <button
            type="button"
            onClick={expandDescendants}
            disabled={!selectedNodeId || isExpandingDescendants}
            className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50 hover:bg-muted"
          >
            {isExpandingDescendants ? 'Loading descendants...' : 'Expand Descendants'}
          </button>
          <button
            type="button"
            onClick={collapseSelectedBranch}
            disabled={!selectedNodeId}
            className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50 hover:bg-muted"
          >
            Collapse/Expand Branch
          </button>
          <button
            type="button"
            onClick={expandAllBranches}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Expand All
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
        {(Object.keys(relationFilters) as GraphMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => void toggleFilter(mode)}
            className={`rounded-full border px-2 py-1 text-xs ${
              relationFilters[mode]
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground'
            }`}
          >
            {mode}
            {loadingRelationMode === mode ? '...' : ''}
          </button>
        ))}
      </div>

      <div ref={graphContainerRef} className="h-[420px] w-full md:h-[560px]">
        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges as Edge[]}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodeClick={onNodeClick}
          fitView
          minZoom={0.2}
          maxZoom={1.8}
          panOnScroll
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <MiniMap pannable zoomable nodeStrokeWidth={3} />
          <Controls showFitView showZoom showInteractive />
        </ReactFlow>
      </div>
      {!hasGraph && (
        <p className="px-2 py-2 text-sm text-muted-foreground">
          No graph edges available for current filters.
        </p>
      )}
      {isFetching && (
        <p className="px-2 py-1 text-xs text-muted-foreground">Refreshing graph data...</p>
      )}
    </section>
  );
}

export function GraphCanvas(props: GraphCanvasProps) {
  return <GraphCanvasInner {...props} />;
}
