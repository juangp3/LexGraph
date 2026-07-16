import { NextResponse } from 'next/server';
import { WordDetails } from '@/types/word-details';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidFallbackData: Record<string, WordDetails> = {
  'd694f27c-633c-44a9-a881-130b223b1120': {
    word: 'father',
    language: 'English',
    meaning: 'A man in relation to his natural child or children.',
    sources: ['MSW fallback'],
    timeline: 'Proto-Indo-European -> Modern English',
    ancestry: [{ language: 'Modern English', stage: 'father' }],
  },
  'fca87886-e8f8-47e2-9baa-329c2f79ff47': {
    word: 'mother',
    language: 'English',
    meaning: 'A woman in relation to her natural child or children.',
    sources: ['MSW fallback'],
    timeline: 'Proto-Indo-European -> Modern English',
    ancestry: [{ language: 'Modern English', stage: 'mother' }],
  },
  '6f49fc8d-c95e-425b-8bde-4f9682a41acd': {
    word: '*ph2ter',
    language: 'Proto-Indo-European',
    meaning: 'Reconstructed root for father terms.',
    sources: ['MSW fallback'],
    timeline: 'Proto-Indo-European',
    ancestry: [{ language: 'Proto-Indo-European', stage: '*ph2ter' }],
  },
  '37e7f503-a5ca-43e7-ba7b-09a458c1de95': {
    word: '*fader',
    language: 'Proto-Germanic',
    meaning: 'Proto-Germanic form linked to father lexemes.',
    sources: ['MSW fallback'],
    timeline: 'Proto-Germanic',
    ancestry: [{ language: 'Proto-Germanic', stage: '*fader' }],
  },
  'f1a49ab9-fbbe-4d16-b693-3af0a4a17e00': {
    word: 'faeder',
    language: 'Old English',
    meaning: 'Old English predecessor of father.',
    sources: ['MSW fallback'],
    timeline: 'Old English',
    ancestry: [{ language: 'Old English', stage: 'faeder' }],
  },
  '8d0f8c4c-01d3-4e94-8a1f-df8a30260b49': {
    word: 'fathir',
    language: 'Old Norse',
    meaning: 'Old Norse cognate for father terms.',
    sources: ['MSW fallback'],
    timeline: 'Old Norse',
    ancestry: [{ language: 'Old Norse', stage: 'fathir' }],
  },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ word: string }> }
) {
  const { word } = await params;

  const isLikelyWordId = UUID_REGEX.test(word);

  if (isLikelyWordId) {
    try {
      const backendResponse = await fetch(
        `${API_BASE}/v1/words/${encodeURIComponent(word)}`
      );

      if (backendResponse.ok) {
        const payload = await backendResponse.json();

        const normalized: WordDetails = {
          word: payload.textOriginal ?? word,
          language: payload.language ?? 'Unknown',
          meaning:
            payload.meanings?.[0]?.gloss ?? 'Meaning unavailable for this node.',
          sources:
            payload.sources?.map((source: { title?: string; sourceLocator?: string }) =>
              source.title
                ? source.title
                : source.sourceLocator
                  ? `Source: ${source.sourceLocator}`
                  : 'Unattributed source'
            ) ?? [],
          timeline: payload.stage
            ? `${payload.language} (${payload.stage})`
            : payload.language ?? 'Unknown timeline',
          ancestry: [{ language: payload.language ?? 'Unknown', stage: payload.textOriginal ?? word }],
        };

        return NextResponse.json(normalized);
      }
    } catch {
      // Fall through to local fallback.
    }

    const uuidFallback = uuidFallbackData[word.toLowerCase()];
    if (uuidFallback) {
      return NextResponse.json(uuidFallback);
    }

    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        word,
        language: 'Unknown',
        meaning: 'Meaning unavailable for this node.',
        sources: [],
        timeline: 'Unknown timeline',
        ancestry: [{ language: 'Unknown', stage: word }],
      } satisfies WordDetails);
    }
  }

  const mockData: { [key: string]: WordDetails } = {
    father: {
      word: 'father',
      language: 'English',
      meaning: 'A man in relation to his natural child or children.',
      sources: ['Oxford English Dictionary', 'Etymonline'],
      timeline: 'Proto-Indo-European -> Modern English',
      ancestry: [
        { language: 'Proto-Indo-European', stage: '*ph2ter' },
        { language: 'Proto-Germanic', stage: '*fader' },
        { language: 'Old English', stage: 'faeder' },
        { language: 'Middle English', stage: 'fader' },
        { language: 'Modern English', stage: 'father' },
      ],
    },
    mother: {
      word: 'mother',
      language: 'English',
      meaning: 'A woman in relation to her natural child or children.',
      sources: ['Wiktionary (etymology)', 'Etymonline'],
      timeline: 'Proto-Indo-European -> Modern English',
      ancestry: [
        { language: 'Proto-Indo-European', stage: '*meh2ter' },
        { language: 'Proto-Germanic', stage: '*moder' },
        { language: 'Old English', stage: 'modor' },
        { language: 'Middle English', stage: 'moder' },
        { language: 'Modern English', stage: 'mother' },
      ],
    },
    brother: {
      word: 'brother',
      language: 'English',
      meaning: 'A male sibling.',
      sources: ['Oxford English Dictionary'],
      timeline: 'Proto-Indo-European -> Modern English',
      ancestry: [
        { language: 'Proto-Indo-European', stage: '*bhreh2ter' },
        { language: 'Proto-Germanic', stage: '*brother' },
        { language: 'Old English', stage: 'brothor' },
        { language: 'Middle English', stage: 'brother' },
        { language: 'Modern English', stage: 'brother' },
      ],
    },
    daughter: {
      word: 'daughter',
      language: 'English',
      meaning: 'A female child.',
      sources: ['Wiktionary (etymology)'],
      timeline: 'Proto-Indo-European -> Modern English',
      ancestry: [
        { language: 'Proto-Indo-European', stage: '*dhugh2ter' },
        { language: 'Proto-Germanic', stage: '*duhter' },
        { language: 'Old English', stage: 'dohtor' },
        { language: 'Middle English', stage: 'doughter' },
        { language: 'Modern English', stage: 'daughter' },
      ],
    },
    ancestor: {
      word: 'ancestor',
      language: 'English',
      meaning: 'A person from whom one is descended.',
      sources: ['Etymonline'],
      timeline: 'Latin -> Old French -> Modern English',
      ancestry: [
        { language: 'Latin', stage: 'antecessor' },
        { language: 'Old French', stage: 'ancestre' },
        { language: 'Middle English', stage: 'auncestre' },
        { language: 'Modern English', stage: 'ancestor' },
      ],
    },
  };

  const wordDetails = mockData[word.toLowerCase()];

  if (wordDetails) {
    return NextResponse.json(wordDetails);
  } else {
    return new NextResponse('Word not found', { status: 404 });
  }
}
