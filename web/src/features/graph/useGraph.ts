import { useQuery } from '@tanstack/react-query';
import { graphService, type GraphLayout } from './graph.service';

export const useGraph = (
  rootWordId: string | null,
  depth = 6,
  fallbackWord?: string | null,
  layout: GraphLayout = 'hierarchical'
) => {
  return useQuery({
    queryKey: ['graph', 'ancestors', rootWordId, depth, fallbackWord, layout],
    queryFn: ({ signal }) =>
      graphService.fetchAncestorsFlow(rootWordId as string, depth, fallbackWord, signal, layout),
    enabled: !!rootWordId,
  });
};
