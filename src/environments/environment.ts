import type { Environment } from './environment.model';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase.env';

/** Production environment. Supabase settings come from `.env` or CI env vars – see `.env.example`. */
export const environment: Environment = {
  production: true,
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_PUBLISHABLE_KEY,
    timeoutMs: 20000,
  },
};
