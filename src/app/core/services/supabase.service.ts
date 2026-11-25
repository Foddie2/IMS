import { isPlatformBrowser } from '@angular/common';
import { InjectionToken, PLATFORM_ID, Service, inject } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import type { Environment } from '../../../environments/environment.model';

export type SupabaseConfig = Environment['supabase'];

export const SUPABASE_CONFIG = new InjectionToken<SupabaseConfig>('SUPABASE_CONFIG', {
  providedIn: 'root',
  factory: () => ({ ...environment.supabase, url: environment.supabase.url.replace(/\/+$/, '') }),
});

/**
 * Owns the single Supabase client. The SDK is lazy-loaded (kept out of the initial
 * bundle) and only created in the browser – SSR/prerender never talks to Supabase.
 */
@Service()
export class SupabaseService {
  private readonly config = inject(SUPABASE_CONFIG);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private clientPromise: Promise<SupabaseClient> | null = null;

  /** False → the app runs in demo mode on sample data. */
  readonly isConfigured = this.config.url.length > 0 && this.config.anonKey.length > 0;
  readonly timeoutMs = this.config.timeoutMs;

  /** Resolves to the shared client. Only call in the browser when `isConfigured`. */
  client(): Promise<SupabaseClient> {
    if (!this.isBrowser || !this.isConfigured) {
      return Promise.reject(new Error('Supabase is not available in this context.'));
    }
    this.clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(this.config.url, this.config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
    );
    return this.clientPromise;
  }
}
