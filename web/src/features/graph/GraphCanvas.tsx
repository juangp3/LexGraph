"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraph } from './useGraph';

interface GraphCanvasProps {
  rootWordId: string | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string, label: string) => void;
}

function GraphCanvasInner({ rootWordId, selectedNodeId, onSelectNode }: GraphCanvasProps) {
  const { data, isLoading, isError } = useGraph(rootWordId, 6);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlow = useReactFlow();

  useEffect(() => {
    if (!data) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const nextNodes = data.nodes.map((node) => {
      const isSelected = selectedNodeId === node.id;
      return {
        ...node,
        selected: isSelected,
        style: {
          ...(node.style ?? {}),
          boxShadow: isSelected ? '0 0 0 2px oklch(0.708 0 0)' : 'none',
        },
      };
    });

    setNodes(nextNodes);
    setEdges(data.edges);
  }, [data, selectedNodeId, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectNode(node.id, String(node.data?.label ?? node.id));
    },
    [onSelectNode]
  );

  const hasGraph = useMemo(() => nodes.length > 0, [nodes.length]);

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
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border/80 bg-card p-2" aria-label="Graph workspace">
      <div className="flex items-center justify-between px-2 py-1">
        <h2 className="text-sm uppercase text-muted-foreground">Interactive Graph</h2>
        <button
          type="button"
          onClick={() => reactFlow.fitView({ padding: 0.2 })}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
        >
          Fit View
        </button>
      </div>
      <div className="h-[460px] w-full md:h-[560px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          minZoom={0.2}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <MiniMap pannable zoomable nodeStrokeWidth={3} />
          <Controls showFitView showZoom showInteractive={false} />
        </ReactFlow>
      </div>
      {!hasGraph && (
        <p className="px-2 py-2 text-sm text-muted-foreground">No graph edges available for this word.</p>
      )}
    </section>
  );
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
