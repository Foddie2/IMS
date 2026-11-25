import type { Environment } from './environment.model';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase.env';

/** Development environment (`npm start`). Supabase settings come from `.env` – see `.env.example`. */
export const environment: Environment = {
  production: false,
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_PUBLISHABLE_KEY,
    timeoutMs: 20000,
  },
};
