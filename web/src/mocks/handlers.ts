import { http, HttpResponse } from 'msw';

const WORD_IDS = {
  father: 'd694f27c-633c-44a9-a881-130b223b1120',
  mother: 'fca87886-e8f8-47e2-9baa-329c2f79ff47',
  daughter: '1f4c2db8-7cdd-4a52-9a7f-a4d4a22bde17',
  pieFather: '6f49fc8d-c95e-425b-8bde-4f9682a41acd',
  pgFather: '37e7f503-a5ca-43e7-ba7b-09a458c1de95',
  oeFather: 'f1a49ab9-fbbe-4d16-b693-3af0a4a17e00',
  oldNorse: '8d0f8c4c-01d3-4e94-8a1f-df8a30260b49',
} as const;

const wordDetailsById: Record<string, { textOriginal: string; language: string; stage?: string }> = {
  [WORD_IDS.father]: { textOriginal: 'father', language: 'English', stage: 'Modern English' },
  [WORD_IDS.mother]: { textOriginal: 'mother', language: 'English', stage: 'Modern English' },
  [WORD_IDS.daughter]: { textOriginal: 'daughter', language: 'English', stage: 'Modern English' },
  [WORD_IDS.pieFather]: { textOriginal: '*ph2ter', language: 'Proto-Indo-European', stage: 'Proto' },
  [WORD_IDS.pgFather]: { textOriginal: '*fader', language: 'Proto-Germanic', stage: 'Proto' },
  [WORD_IDS.oeFather]: { textOriginal: 'faeder', language: 'Old English', stage: 'Old English' },
  [WORD_IDS.oldNorse]: { textOriginal: 'fathir', language: 'Old Norse', stage: 'Old Norse' },
};

export const handlers = [
  http.get('http://localhost:3001/v1/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    let results: any[] = [];
    if (query === 'father') {
      results = [
        {
          wordId: WORD_IDS.father,
          textOriginal: 'father',
          language: 'English',
        },
      ];
    } else if (query === 'mother') {
      results = [
        {
          wordId: WORD_IDS.mother,
          textOriginal: 'mother',
          language: 'English',
        },
      ];
    }

    return HttpResponse.json({ results });
  }),

  http.get('http://localhost:3001/v1/graph/ancestors/:wordId', ({ params, request }) => {
    const wordId = String(params.wordId);
    const depth = Number(new URL(request.url).searchParams.get('depth') ?? '6');

    if (wordId !== WORD_IDS.father) {
      return HttpResponse.json({ wordId, depth, edges: [] });
    }

    return HttpResponse.json({
      wordId,
      depth,
      edges: [
        {
          edgeId: 'edge-pie-pg',
          fromWordId: WORD_IDS.pieFather,
          toWordId: WORD_IDS.pgFather,
          relationType: 'EVOLVED_FROM',
          confidence: 0.92,
          method: 'manual',
          isDisputed: false,
          evidenceSummary: 'Mock PIE to Proto-Germanic lineage',
          depth: 2,
          path: [WORD_IDS.pieFather, WORD_IDS.pgFather],
          sources: [],
        },
        {
          edgeId: 'edge-pg-oe',
          fromWordId: WORD_IDS.pgFather,
          toWordId: WORD_IDS.oeFather,
          relationType: 'EVOLVED_FROM',
          confidence: 0.95,
          method: 'manual',
          isDisputed: false,
          evidenceSummary: 'Mock Proto-Germanic to Old English',
          depth: 1,
          path: [WORD_IDS.pgFather, WORD_IDS.oeFather],
          sources: [],
        },
        {
          edgeId: 'edge-oe-en',
          fromWordId: WORD_IDS.oeFather,
          toWordId: WORD_IDS.father,
          relationType: 'EVOLVED_FROM',
          confidence: 0.97,
          method: 'manual',
          isDisputed: false,
          evidenceSummary: 'Mock Old English to Modern English',
          depth: 0,
          path: [WORD_IDS.oeFather, WORD_IDS.father],
          sources: [],
        },
      ],
    });
  }),

  http.get('http://localhost:3001/v1/graph/descendants/:wordId', ({ params, request }) => {
    const wordId = String(params.wordId);
    const depth = Number(new URL(request.url).searchParams.get('depth') ?? '3');

    if (wordId !== WORD_IDS.father) {
      return HttpResponse.json({ wordId, depth, edges: [] });
    }

    return HttpResponse.json({
      wordId,
      depth,
      edges: [
        {
          edgeId: 'edge-en-daughter',
          fromWordId: WORD_IDS.father,
          toWordId: WORD_IDS.daughter,
          relationType: 'EVOLVED_FROM',
          confidence: 0.78,
          method: 'manual',
          isDisputed: false,
          evidenceSummary: 'Mock descendant branch',
          depth: 1,
          path: [WORD_IDS.father, WORD_IDS.daughter],
          sources: [],
        },
      ],
    });
  }),

  http.get('http://localhost:3001/v1/graph/borrowings/:wordId', ({ params, request }) => {
    const wordId = String(params.wordId);
    const depth = Number(new URL(request.url).searchParams.get('depth') ?? '3');

    if (wordId !== WORD_IDS.father) {
      return HttpResponse.json({ wordId, depth, edges: [] });
    }

    return HttpResponse.json({
      wordId,
      depth,
      edges: [
        {
          edgeId: 'edge-borrowing-1',
          fromWordId: WORD_IDS.oldNorse,
          toWordId: WORD_IDS.oeFather,
          relationType: 'BORROWED_FROM',
          confidence: 0.67,
          method: 'computed',
          isDisputed: false,
          evidenceSummary: 'Mock borrowing signal',
          depth: 1,
          path: [WORD_IDS.oldNorse, WORD_IDS.oeFather],
          sources: [],
        },
      ],
    });
  }),

  http.get('http://localhost:3001/v1/graph/cognates/:wordId', ({ params, request }) => {
    const wordId = String(params.wordId);
    const depth = Number(new URL(request.url).searchParams.get('depth') ?? '2');

    if (wordId !== WORD_IDS.father) {
      return HttpResponse.json({ wordId, depth, edges: [] });
    }

    return HttpResponse.json({
      wordId,
      depth,
      edges: [
        {
          edgeId: 'edge-cognate-1',
          fromWordId: WORD_IDS.oldNorse,
          toWordId: WORD_IDS.pgFather,
          relationType: 'COGNATE_WITH',
          confidence: 0.73,
          method: 'computed',
          isDisputed: false,
          evidenceSummary: 'Mock cognate branch',
          depth: 1,
          path: [WORD_IDS.oldNorse, WORD_IDS.pgFather],
          sources: [],
        },
      ],
    });
  }),

  http.get('http://localhost:3001/v1/words/:wordId', ({ params }) => {
    const wordId = String(params.wordId);
    const details = wordDetailsById[wordId];

    if (!details) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json({
      wordId,
      textOriginal: details.textOriginal,
      textNormalized: details.textOriginal.toLowerCase(),
      language: details.language,
      stage: details.stage ?? null,
      meanings: [{ gloss: `Mock meaning for ${details.textOriginal}` }],
      sources: [{ title: 'Mock Source', sourceLocator: 'msw:1' }],
    });
  }),
];
