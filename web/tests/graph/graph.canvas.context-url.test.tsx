import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

let currentNodes: any[] = [];

vi.mock('reactflow/dist/style.css', () => ({}));

vi.mock('reactflow', async () => {
  const React = await vi.importActual('react');
  return {
    __esModule: true,
    default: ({ nodes, edges, onNodeClick, onNodeDoubleClick, onNodeContextMenu, onNodeMouseEnter, onNodeMouseLeave, children }: any) => {
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
              onContextMenu: (e: any) => onNodeContextMenu && onNodeContextMenu(e, n),
              onMouseEnter: (e: any) => onNodeMouseEnter && onNodeMouseEnter(e, n),
              onMouseLeave: () => onNodeMouseLeave && onNodeMouseLeave(),
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

const fetchMock = vi.fn();
vi.mock('@/features/graph/graph.service', () => ({
  graphService: { fetchTraversalFlow: fetchMock },
  mergeFlowGraphs: (arr: any[]) => arr.filter(Boolean)[0] ?? { nodes: [], edges: [] },
}));

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

import { GraphCanvas } from '@/features/graph/GraphCanvas';

describe('GraphCanvas context menu and URL sync', () => {
  beforeEach(() => {
    currentNodes = [];
    vi.clearAllMocks();
    // reset URL
    window.history.replaceState({}, '', '/workspace');
  });

  it('shows context menu on right-click and triggers expand', async () => {
    const onSelect = vi.fn();
    render(<GraphCanvas rootWordId="A" rootWordText="A" selectedNodeId={null} onSelectNode={onSelect} />);

    const nodeA = await screen.findByText('A');
    // right click
    await userEvent.click(nodeA, { button: 2 });

    const menuButton = await screen.findByText('Expand Descendants');
    expect(menuButton).toBeTruthy();

    await userEvent.click(menuButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('descendants', 'A', 3));
  });

  it('reads selection and expanded from URL on mount', async () => {
    // set URL with selection and expanded
    window.history.replaceState({}, '', '/workspace?sel=B&expanded=B,C');
    const onSelect = vi.fn();
    render(<GraphCanvas rootWordId="A" rootWordText="A" selectedNodeId={null} onSelectNode={onSelect} />);

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('B', 'B'));
    // expand called for B and C
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('descendants', 'B', 3));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('descendants', 'C', 3));
  });
});
