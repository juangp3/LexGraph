import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mocks: reactflow, useGraph, graph.store
let currentNodes: any[] = [];

vi.mock('reactflow/dist/style.css', () => ({}));

vi.mock('reactflow', async () => {
  const React = await vi.importActual('react');
  return {
    __esModule: true,
    default: ({ nodes, edges, onNodeClick, onNodeDoubleClick, children }: any) => {
      // update shared nodes cache for useReactFlow mock
      currentNodes = nodes ?? [];
      return React.createElement(
        'div',
        { 'data-testid': 'reactflow' },
        (nodes ?? []).map((n: any) =>
          React.createElement(
            'div',
            {
              key: n.id,
              className: 'react-flow__node',
              'data-id': n.id,
              style: { left: n.position?.x ?? 0, top: n.position?.y ?? 0 },
              onClick: () => onNodeClick && onNodeClick(null, n),
              onDoubleClick: () => onNodeDoubleClick && onNodeDoubleClick(null, n),
            },
            n.data?.label ?? n.id
          )
        ),
        children
      );
    },
    Background: () => React.createElement('div', {}),
    Controls: () => React.createElement('div', {}),
    MiniMap: () => React.createElement('div', {}),
    useReactFlow: () => ({
      getNodes: () => currentNodes,
      setNodes: (updater: any) => {
        try {
          const next = typeof updater === 'function' ? updater(currentNodes) : updater;
          currentNodes = next;
        } catch {}
      },
      getZoom: () => 1,
      fitView: () => {},
      setCenter: (x: number, y: number, opts?: any) => {},
    }),
  };
});

vi.mock('@/features/graph/useGraph', () => ({
  useGraph: () => ({
    data: {
      nodes: [
        { id: 'A', position: { x: 0, y: 0 }, data: { label: 'A' } },
        { id: 'B', position: { x: 120, y: 0 }, data: { label: 'B' } },
        { id: 'C', position: { x: 0, y: 120 }, data: { label: 'C' } },
      ],
      edges: [
        { id: 'e1', source: 'A', target: 'B', data: { mode: 'ancestors' } },
        { id: 'e2', source: 'A', target: 'C', data: { mode: 'ancestors' } },
      ],
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/graph/graph.store', () => ({
  useGraphStore: () => ({
    relationFilters: { ancestors: true, descendants: true, borrowings: false, cognates: false },
    toggleFilter: vi.fn(),
    resetRelationFilters: vi.fn(),
  }),
}));

vi.mock('@/features/graph/graph.service', () => ({
  graphService: { fetchTraversalFlow: vi.fn() },
  mergeFlowGraphs: (arr: any[]) => {
    // naive merge: pick first non-null
    return arr.filter(Boolean)[0] ?? { nodes: [], edges: [] };
  },
}));

import { GraphCanvas } from '@/features/graph/GraphCanvas';

describe('GraphCanvas arrow-key navigation', () => {
  beforeEach(() => {
    currentNodes = [];
    vi.clearAllMocks();
  });

  it('moves selection to the right with ArrowRight', async () => {
    const onSelect = vi.fn();
    render(<GraphCanvas rootWordId="A" rootWordText="A" selectedNodeId={null} onSelectNode={onSelect} />);

    // ensure nodes rendered
    await waitFor(() => expect(screen.getByText('A')).toBeTruthy());

    // press ArrowRight to move selection to B
    await userEvent.keyboard('{ArrowRight}');

    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    expect(onSelect).toHaveBeenCalledWith('B', expect.any(String));
  });

  it('moves selection down with ArrowDown', async () => {
    const onSelect = vi.fn();
    render(<GraphCanvas rootWordId="A" rootWordText="A" selectedNodeId={null} onSelectNode={onSelect} />);

    await waitFor(() => expect(screen.getByText('A')).toBeTruthy());

    await userEvent.keyboard('{ArrowDown}');

    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    expect(onSelect).toHaveBeenCalledWith('C', expect.any(String));
  });
});
