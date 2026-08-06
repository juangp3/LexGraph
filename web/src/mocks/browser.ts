import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

// Ensure MSW is never active in production
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    '[LexGraph] MSW browser module should not be imported in production. ' +
    'Check your build configuration and imports.'
  );
}

export const worker = setupWorker(...handlers);
