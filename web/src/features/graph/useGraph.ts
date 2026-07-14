import { useQuery } from '@tanstack/react-query';
import { graphService } from './graph.service';

export const useGraph = (
  rootWordId: string | null,
  depth = 6,
  fallbackWord?: string | null
) => {
  return useQuery({
    queryKey: ['graph', 'ancestors', rootWordId, depth, fallbackWord],
    queryFn: () =>
      graphService.fetchAncestorsFlow(rootWordId as string, depth, fallbackWord),
    enabled: !!rootWordId,
  });
};
