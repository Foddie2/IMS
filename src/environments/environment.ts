import type { Environment } from './environment.model';

/**
 * Production build. Point `apiUrl` at your deployed IMS API (and add this site's origin to the
 * API's `Cors:AllowedOrigins`). No database credentials or keys ever live in the frontend.
 */
export const environment: Environment = {
  production: true,
  apiUrl: 'http://localhost:5000/api',
  showDemoLogins: true,
  refreshIntervalMs: 30000,
};
