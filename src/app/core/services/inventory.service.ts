import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Observable, TimeoutError, catchError, from, map, of, timeout } from 'rxjs';
import { buildSampleSnapshot, sampleOperationalData } from '../data/sample-inventory';
import { InventorySnapshot } from '../models/inventory.models';
import {
  ActivityEventRow,
  CategoryRow,
  ProductRow,
  SiteRow,
  StockLevelRow,
} from '../models/supabase.models';
import { SupabaseRows, mapSupabaseData } from '../utils/inventory.mapper';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

/** PostgREST returns at most 1000 rows per request by default. */
const PAGE_SIZE = 1000;
const REALTIME_TABLES = ['stock_levels', 'products', 'activity_events'] as const;
const REALTIME_DEBOUNCE_MS = 400;

export type RealtimeStatus = 'off' | 'connecting' | 'live' | 'error';

interface QueryResult {
  data: unknown[] | null;
  error: { message: string; code?: string } | null;
}

/** Reads every page of a query; `page(from, to)` must build a fresh, ordered query each time. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<QueryResult>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await page(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

/**
 * Loads the inventory snapshot from Supabase and keeps it in sync via Realtime.
 *
 * What the user can see is decided by row-level security in the database, so the
 * same queries return all sites for an admin and only assigned sites for an operator.
 * Without Supabase configured (or if loading fails) the bundled sample data is shown
 * with a notice. Site scoping and metrics live in `InventoryInsightsService`.
 */
@Service()
export class InventoryService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly resource = rxResource<InventorySnapshot, string | undefined>({
    // Browser only. 'demo' = sample data; otherwise the signed-in user id, so data reloads
    // per user and is cleared on sign-out (params → undefined → idle).
    params: () => {
      if (!this.isBrowser) return undefined;
      if (!this.supabase.isConfigured) return 'demo';
      return this.auth.userId() ?? undefined;
    },
    stream: ({ params }) => (params === 'demo' ? of(this.demoSnapshot()) : this.loadLive()),
  });

  readonly realtime = signal<RealtimeStatus>('off');

  readonly snapshot = computed(() => (this.resource.hasValue() ? this.resource.value() : null));
  readonly isLoading = computed(() => this.snapshot() === null);
  readonly isRefreshing = computed(() => this.snapshot() !== null && this.resource.isLoading());

  readonly source = computed(() => this.snapshot()?.source ?? null);
  readonly notice = computed(() => this.snapshot()?.notice ?? null);
  readonly syncedAt = computed(() => this.snapshot()?.syncedAt ?? null);
  readonly items = computed(() => this.snapshot()?.items ?? []);
  readonly categories = computed(() => this.snapshot()?.categories ?? []);
  readonly sites = computed(() => this.snapshot()?.sites ?? []);
  readonly activity = computed(() => this.snapshot()?.activity ?? []);
  readonly flow = computed(() => this.snapshot()?.flow ?? []);
  readonly operations = computed(() => this.snapshot()?.operations ?? null);

  constructor() {
    // Realtime: refresh (debounced) whenever stock, products or activity change.
    effect((onCleanup) => {
      const userId = this.auth.userId();
      if (!this.isBrowser || !this.supabase.isConfigured || !userId) return;

      let cancelled = false;
      let channel: RealtimeChannel | null = null;
      let debounce: ReturnType<typeof setTimeout> | undefined;
      const scheduleReload = () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => this.reload(), REALTIME_DEBOUNCE_MS);
      };

      this.realtime.set('connecting');
      void this.supabase.client().then((client) => {
        if (cancelled) return;
        channel = client.channel(`inventory-${userId}`);
        for (const table of REALTIME_TABLES) {
          channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleReload);
        }
        channel.subscribe((status) => {
          if (cancelled) return;
          this.realtime.set(
            status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'off' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'error' : 'connecting',
          );
        });
      });

      onCleanup(() => {
        cancelled = true;
        clearTimeout(debounce);
        this.realtime.set('off');
        if (channel) {
          const stale = channel;
          void this.supabase.client().then((client) => client.removeChannel(stale));
        }
      });
    });
  }

  reload(): void {
    this.resource.reload();
  }

  private demoSnapshot(): InventorySnapshot {
    return buildSampleSnapshot('Supabase is not configured – showing sample data.');
  }

  private loadLive(): Observable<InventorySnapshot> {
    return from(this.fetchRows()).pipe(
      timeout(this.supabase.timeoutMs),
      map((rows): InventorySnapshot => ({
        source: 'live',
        notice: null,
        syncedAt: new Date().toISOString(),
        ...mapSupabaseData(rows),
        // No orders/shipments tables yet: keep sample series for those widgets.
        ...sampleOperationalData(),
      })),
      catchError((error: unknown) => of(buildSampleSnapshot(describeError(error)))),
    );
  }

  private async fetchRows(): Promise<SupabaseRows> {
    const client = await this.supabase.client();
    const [sites, categories, products, stock, activity] = await Promise.all([
      fetchAll<SiteRow>((a, b) => client.from('sites').select('id, name, city, map_x, map_y').order('id').range(a, b)),
      fetchAll<CategoryRow>((a, b) => client.from('categories').select('id, name').order('id').range(a, b)),
      fetchAll<ProductRow>((a, b) =>
        client
          .from('products')
          .select('id, sku, name, description, unit_price, units, minimum_stock, barcode, image_url, category:categories(name)')
          .eq('active', true)
          .order('id')
          .range(a, b),
      ),
      fetchAll<StockLevelRow>((a, b) =>
        client.from('stock_levels').select('product_id, site_id, quantity, updated_at').order('product_id').order('site_id').range(a, b),
      ),
      client
        .from('activity_events')
        .select('id, type, title, detail, site_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as ActivityEventRow[];
        }),
    ]);
    return { sites, categories, products, stock, activity };
  }
}

function describeError(error: unknown): string {
  if (error instanceof TimeoutError) {
    return 'Supabase did not respond in time.';
  }
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  if (code === '42P01' || code === 'PGRST205') {
    return 'Database tables are missing – run supabase/migrations/0001_inventory_schema.sql.';
  }
  if (code === 'PGRST301' || code === '401') {
    return 'Your session has expired – please sign in again.';
  }
  if (error instanceof TypeError) {
    return 'Supabase is unreachable (check the project URL and your connection).';
  }
  return message ? `Supabase error: ${message}` : 'Supabase data could not be loaded.';
}
