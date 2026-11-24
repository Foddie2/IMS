import type { Environment } from './environment.model';

/**
 * Production environment.
 *
 * The browser talks to `/inventree/api` on the dashboard's own server, which forwards
 * to InvenTree with the token from the INVENTREE_URL / INVENTREE_TOKEN environment
 * variables (see src/server.ts). No token is ever bundled into the frontend.
 */
export const environment: Environment = {
  production: true,
  inventree: {
    apiUrl: '/inventree/api',
    webUrl: 'https://demo.inventree.org',
    token: '',
    timeoutMs: 20000,
    pageSize: 500,
    refreshIntervalMs: 60000,
  },
};
