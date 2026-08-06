'use client';

import { useSyncExternalStore } from 'react';
import type { GraphMode } from './graph.service';

type GraphStoreState = {
  relationFilters: Record<GraphMode, boolean>;
};

type GraphStoreApi = GraphStoreState & {
  toggleFilter: (mode: GraphMode) => void;
  resetRelationFilters: () => void;
};

const defaultRelationFilters: Record<GraphMode, boolean> = {
  ancestors: true,
  descendants: true,
  borrowings: true,
  cognates: true,
};

let state: GraphStoreState = {
  relationFilters: { ...defaultRelationFilters },
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function setState(nextState: GraphStoreState) {
  state = nextState;
  emitChange();
}

function toggleFilter(mode: GraphMode) {
  setState({
    relationFilters: {
      ...state.relationFilters,
      [mode]: !state.relationFilters[mode],
    },
  });
}

function resetRelationFilters() {
  setState({ relationFilters: { ...defaultRelationFilters } });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGraphStore(): GraphStoreApi {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);

  return {
    ...snapshot,
    toggleFilter,
    resetRelationFilters,
  };
}