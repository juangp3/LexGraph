import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('http://localhost:3001/v1/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    let results: any[] = [];
    if (query === 'father') {
      results = [
        {
          wordId: 'father',
          textOriginal: 'father',
          language: 'English',
        },
      ];
    } else if (query === 'mother') {
      results = [
        {
          wordId: 'mother',
          textOriginal: 'mother',
          language: 'English',
        },
      ];
    }

    return HttpResponse.json({ results });
  }),
];
