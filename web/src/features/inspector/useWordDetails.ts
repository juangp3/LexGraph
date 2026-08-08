import { useQuery } from '@tanstack/react-query';
import { inspectorService } from './inspector.service';
import { WordDetails } from '@/types/word-details';

export const useWordDetails = (wordId: string | null | undefined) => {
  return useQuery<WordDetails>({
    queryKey: ['wordDetails', wordId],
    queryFn: () => inspectorService.getWordDetails(wordId as string),
    enabled: !!wordId,
  });
};
