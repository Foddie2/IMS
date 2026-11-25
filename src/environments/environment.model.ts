export interface Environment {
  production: boolean;
  /** Base URL of the IMS ASP.NET Core API, including the `/api` prefix. */
  apiUrl: string;
  /** Show the one-click SuperAdmin / Admin / User demo login buttons on the sign-in page. */
  showDemoLogins: boolean;
  /** Background refresh of dashboard data while the tab is visible; 0 disables it. */
  refreshIntervalMs: number;
}
