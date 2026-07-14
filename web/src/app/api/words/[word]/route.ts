import { NextResponse } from 'next/server';
import { WordDetails } from '@/types/word-details';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ word: string }> }
) {
  const { word } = await params;

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
