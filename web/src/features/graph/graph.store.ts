import { create } from 'zustand';
import type { GraphMode } from '@/features/graph/graph.service';

interface GraphState {
  relationFilters: Record<GraphMode, boolean>;
  toggleFilter: (mode: GraphMode) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  relationFilters: {
    ancestors: true,
    descendants: false,
    borrowings: false,
    cognates: false,
  },
  toggleFilter: (mode) =>
    set((state) => ({
      relationFilters: {
        ...state.relationFilters,
        [mode]: !state.relationFilters[mode],
      },
    })),
}));
