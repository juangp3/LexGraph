import { useQuery } from '@tanstack/react-query';
import { inspectorService } from './inspector.service';
import { WordDetails } from '@/types/word-details';

export const useWordDetails = (word: string | null) => {
  return useQuery<WordDetails>({
    queryKey: ['wordDetails', word],
    queryFn: () => inspectorService.getWordDetails(word as string),
    enabled: !!word,
  });
};
