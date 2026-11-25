export interface Environment {
  production: boolean;
  supabase: {
    /** Project URL: Supabase → Project Settings → API → Project URL. Empty = sample-data demo mode. */
    url: string;
    /**
     * Publishable ("anon") key: Supabase → Project Settings → API Keys.
     * Safe to ship to browsers – row-level security protects the data.
     * NEVER put the `service_role` / secret key here.
     */
    anonKey: string;
    /** Give up on a load after this many milliseconds and show sample data with a notice. */
    timeoutMs: number;
  };
}
