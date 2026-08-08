'use client';

import { useSyncExternalStore } from 'react';

interface SearchStoreState {
  highlightedNodeIds: Set<string>;
}

const listeners = new Set<() => void>();
let state: SearchStoreState = { highlightedNodeIds: new Set() };

function getSnapshot() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((l) => l());
}

export function setHighlightedNodeIds(ids: Set<string>) {
  state = { highlightedNodeIds: ids };
  emit();
}

export function clearHighlights() {
  state = { highlightedNodeIds: new Set() };
  emit();
}

export function useSearchStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
