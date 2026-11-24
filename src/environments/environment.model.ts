export interface Environment {
  production: boolean;
  inventree: {
    /**
     * REST root the browser calls.
     * - `'/inventree/api'` (recommended): the dashboard's own server proxies to InvenTree and
     *   attaches the token from the INVENTREE_URL / INVENTREE_TOKEN env vars (see `.env.example`).
     * - `'https://inventree.example.com/api'`: call InvenTree directly (needs `token` + CORS).
     * - `''`: run on sample data only.
     */
    apiUrl: string;
    /** Public InvenTree web URL, used for "Open in InvenTree" deep links. */
    webUrl: string;
    /**
     * Direct mode only. Shipped to the browser, so use it for local development only.
     * When set, the signed-in InvenTree user's role drives RBAC.
     */
    token: string;
    timeoutMs: number;
    /** Page size for list endpoints; all pages are fetched. */
    pageSize: number;
    /** Background re-sync interval while the tab is visible; 0 disables it. */
    refreshIntervalMs: number;
  };
}
