"use client";

import { toPng } from 'html-to-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  const [showMiniMap, setShowMiniMap] = useState(true);

  useEffect(() => {
    resetRelationFilters();
  }, [rootWordId, resetRelationFilters]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectNode(node.id, String(node.data?.label ?? node.id));
    },
    [onSelectNode]
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // expand descendants for the double-clicked node and select it
      void expandDescendantsFor(node.id);
      onSelectNode(node.id, String(node.data?.label ?? node.id));
    },
    [expandDescendantsFor, onSelectNode]
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

  const expandDescendantsFor = useCallback(async (nodeId: string) => {
    if (!nodeId || expandedDescendantGraphs[nodeId]) return;
    setIsExpandingDescendants(true);
    try {
      const graph = await graphService.fetchTraversalFlow('descendants', nodeId, 3);
      setExpandedDescendantGraphs((prev) => ({ ...prev, [nodeId]: graph }));
    } finally {
      setIsExpandingDescendants(false);
    }
  }, [expandedDescendantGraphs]);

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

  // compute highlighted path edges/nodes (root -> selected, plus descendants from selected)
  const { pathEdgeIds, pathNodeIds } = useMemo(() => {
    const edgeMap = new Map<string, string[]>();
    for (const e of visibleEdges) {
      const arr = edgeMap.get(e.source) ?? [];
      arr.push(e.target);
      edgeMap.set(e.source, arr);
    }

    const bfsPath = (start: string | null, target: string | null) => {
      if (!start || !target) return [] as string[];
      const queue: string[][] = [[start]];
      const visited = new Set<string>([start]);
      while (queue.length) {
        const path = queue.shift() as string[];
        const last = path[path.length - 1];
        if (last === target) return path;
        const neighbors = edgeMap.get(last) ?? [];
        for (const n of neighbors) {
          if (visited.has(n)) continue;
          visited.add(n);
          queue.push([...path, n]);
        }
      }
      return [] as string[];
    };

    const nodeSet = new Set<string>();
    const edgeSet = new Set<string>();

    if (rootWordId && selectedNodeId) {
      const nodesPath = bfsPath(rootWordId, selectedNodeId);
      for (let i = 0; i < nodesPath.length; i++) {
        nodeSet.add(nodesPath[i]);
        if (i < nodesPath.length - 1) edgeSet.add(`${nodesPath[i]}->${nodesPath[i + 1]}`);
      }
    }

    if (selectedNodeId) {
      // dfs descendants from selected
      const stack = [selectedNodeId];
      while (stack.length) {
        const cur = stack.pop() as string;
        nodeSet.add(cur);
        const children = edgeMap.get(cur) ?? [];
        for (const c of children) {
          edgeSet.add(`${cur}->${c}`);
          if (!nodeSet.has(c)) stack.push(c);
        }
      }
    }

    return { pathEdgeIds: edgeSet, pathNodeIds: nodeSet };
  }, [visibleEdges, rootWordId, selectedNodeId]);

  const visibleNodes = useMemo(() => {
    return mergedGraph.nodes
      .filter((node) => visibleNodeIds.has(node.id) && !hiddenDescendants.has(node.id))
      .map((node) => {
        const isSelected = selectedNodeId === node.id;
        const isCollapsed = collapsedNodeIds.has(node.id);
        const isInPath = pathNodeIds.has(node.id);
        return {
          ...node,
          selected: isSelected,
          data: {
            ...(node.data ?? {}),
            label: `${String(node.data?.label ?? node.id)}${isCollapsed ? ' (collapsed)' : ''}`,
          },
          style: {
            ...(node.style ?? {}),
            boxShadow: isSelected ? '0 0 0 2px oklch(0.708 0 0)' : isInPath ? '0 0 8px rgba(59,130,246,0.28)' : 'none',
            opacity: pathNodeIds.size > 0 && !isInPath ? 0.3 : 1,
          },
        };
      });
  }, [mergedGraph.nodes, visibleNodeIds, hiddenDescendants, selectedNodeId, collapsedNodeIds, pathNodeIds]);

  useEffect(() => {
    if (!visibleNodes.length) return;
    const id = requestAnimationFrame(() => {
      reactFlow.fitView({ padding: 0.2, duration: 300 });
    });
    return () => cancelAnimationFrame(id);
  }, [visibleNodes.length, visibleEdges.length, reactFlow]);

  // Global keyboard handlers and custom events (center node, toggle minimap, focus search)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        try { reactFlow.fitView({ padding: 0.2 }); } catch {}
      }
      if (e.key === 'Escape') {
        // clear selection
        try {
          const nodes = reactFlow.getNodes();
          reactFlow.setNodes(nodes.map((n) => ({ ...n, selected: false })));
        } catch {}
      }
      if (e.key === 'Delete') {
        // collapse selected branch
        collapseSelectedBranch();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('lexgraph:focusSearch'));
      }
    };

    const onCenterNode = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent)?.detail ?? {};
        const nodeId = detail?.nodeId as string | undefined;
        if (!nodeId) return;
        const node = reactFlow.getNode(nodeId);
        if (!node) return;
        // select node
        const nodes = reactFlow.getNodes();
        reactFlow.setNodes(nodes.map((n) => ({ ...n, selected: n.id === nodeId })));
        // center the view on the node
        if (typeof (reactFlow as any).setCenter === 'function') {
          try { (reactFlow as any).setCenter(node.position.x, node.position.y, { duration: 200 }); } catch {}
        } else if (typeof (reactFlow as any).setViewport === 'function') {
          try { (reactFlow as any).setViewport({ x: node.position.x, y: node.position.y, zoom: reactFlow.getZoom() }, { duration: 200 }); } catch {}
        } else {
          try { reactFlow.fitView({ padding: 0.2 }); } catch {}
        }
      } catch {}
    };

    const onCenterSelection = () => {
      if (!selectedNodeId) return;
      window.dispatchEvent(new CustomEvent('lexgraph:centerNode', { detail: { nodeId: selectedNodeId } }));
    };

    const onToggleMiniMap = () => setShowMiniMap((v) => !v);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('lexgraph:centerNode' as any, onCenterNode as EventListener);
    window.addEventListener('lexgraph:centerSelection' as any, onCenterSelection as EventListener);
    window.addEventListener('lexgraph:toggleMiniMap' as any, onToggleMiniMap as EventListener);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('lexgraph:centerNode' as any, onCenterNode as EventListener);
      window.removeEventListener('lexgraph:centerSelection' as any, onCenterSelection as EventListener);
      window.removeEventListener('lexgraph:toggleMiniMap' as any, onToggleMiniMap as EventListener);
    };
  }, [reactFlow, selectedNodeId, collapseSelectedBranch]);

  const hasGraph = useMemo(() => visibleNodes.length > 0 && visibleEdges.length > 0, [visibleNodes.length, visibleEdges.length]);

  const graphStateCard = (title: string, body: string, action?: React.ReactNode) => (
    <section className="lex-card rounded-[var(--radius-2xl)] p-5" aria-label="Graph workspace">
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Interactive Graph</h2>
          <p className="text-lg font-semibold text-foreground">{title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{body}</p>
        </div>
        {action}
      </div>
    </section>
  );

  if (!rootWordId) {
    return graphStateCard(
      'Search to begin exploring.',
      'Pick a word from search to load its ancestry graph, inspect its origin, and expand outward without leaving the workspace.'
    );
  }

  if (isLoading) {
    return (
      <section className="lex-card rounded-[var(--radius-2xl)] p-5" aria-label="Graph workspace">
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Interactive Graph</h2>
            <p className="text-sm text-muted-foreground">Loading graph...</p>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-[420px] w-full rounded-[var(--radius-2xl)] md:h-[560px]" />
        </div>
      </section>
    );
  }

  if (isError) {
    return graphStateCard(
      'Unable to load this graph.',
      'The workspace could not retrieve ancestry data for this word. Retry to request the graph again.' ,
      <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
        Retry
      </Button>
    );
  }

  return (
    <section className="lex-card rounded-[var(--radius-2xl)] p-2" aria-label="Graph workspace">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1">
        <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Interactive Graph</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => reactFlow.fitView({ padding: 0.2 })}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
          >
            Fit View
          </button>
          <button
            type="button"
            onClick={downloadPng}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
          >
            Download PNG
          </button>
          <button
            type="button"
            onClick={expandDescendants}
            disabled={!selectedNodeId || isExpandingDescendants}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {isExpandingDescendants ? 'Loading descendants...' : 'Expand Descendants'}
          </button>
          <button
            type="button"
            onClick={collapseSelectedBranch}
            disabled={!selectedNodeId}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Collapse/Expand Branch
          </button>
          <button
            type="button"
            onClick={expandAllBranches}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
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
          edges={visibleEdges.map((edge) => {
            const eid = `${edge.source}->${edge.target}`;
            const isPath = (pathEdgeIds as Set<string>).has(eid);
            return {
              ...edge,
              animated: isPath,
              style: {
                ...(edge.style ?? {}),
                stroke: isPath ? 'var(--graph-edge-ancestor, #60a5fa)' : undefined,
                opacity: pathEdgeIds.size > 0 && !isPath ? 0.18 : 1,
              },
            } as Edge;
          }) as Edge[]}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
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
          {showMiniMap && <MiniMap pannable zoomable nodeStrokeWidth={3} />}
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
