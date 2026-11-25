import type { Environment } from './environment.model';

/** Development (`npm start`): the IMS API from `npm run start:api` on port 5000. */
export const environment: Environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  showDemoLogins: true,
  refreshIntervalMs: 30000,
};
