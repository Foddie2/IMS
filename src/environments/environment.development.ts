import type { Environment } from './environment.model';

/**
 * Development environment. Uses the same server-side proxy as production:
 * put INVENTREE_URL and INVENTREE_TOKEN in a `.env` file (copy `.env.example`)
 * and restart `npm start`.
 */
export const environment: Environment = {
  production: false,
  inventree: {
    apiUrl: '/inventree/api',
    webUrl: 'https://demo.inventree.org',
    token: '',
    timeoutMs: 20000,
    pageSize: 500,
    refreshIntervalMs: 60000,
  },
};
