import { useQuery } from '@tanstack/react-query';
import { graphService } from './graph.service';

export const useGraph = (rootWordId: string | null, depth = 6) => {
  return useQuery({
    queryKey: ['graph', 'ancestors', rootWordId, depth],
    queryFn: () => graphService.fetchAncestorsFlow(rootWordId as string, depth),
    enabled: !!rootWordId,
  });
};
