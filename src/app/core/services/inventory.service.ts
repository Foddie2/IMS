import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, PLATFORM_ID, Service, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, TimeoutError, catchError, forkJoin, map, of, timeout } from 'rxjs';
import { buildSampleSnapshot, sampleOperationalData } from '../data/sample-inventory';
import { InventorySnapshot } from '../models/inventory.models';
import { mapInvenTreeData } from '../utils/inventory.mapper';
import { InvenTreeApiService } from './inventree-api.service';
import { INVENTREE_CONFIG } from './inventree.config';

/**
 * Loads (and periodically re-syncs) the company-wide inventory snapshot.
 *
 * Parts, categories and stock are fetched from InvenTree in parallel, every page. If the API
 * is not configured, unreachable, unauthorised or slow, it transparently falls back to the
 * bundled sample dataset so the dashboard always renders.
 *
 * Site scoping and metrics live in `InventoryInsightsService`.
 */
@Service()
export class InventoryService {
  private readonly api = inject(InvenTreeApiService);
  private readonly config = inject(INVENTREE_CONFIG);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly resource = rxResource<InventorySnapshot, true | undefined>({
    // Only fetch in the browser – prerendered HTML shows the loading skeleton instead
    // of baking build-time data into the page.
    params: () => (this.isBrowser ? true : undefined),
    stream: () => this.load(),
  });

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
    if (this.isBrowser && this.config.refreshIntervalMs > 0) {
      const timer = setInterval(() => {
        // Only re-sync visible tabs, and never stack requests.
        if (this.document.visibilityState === 'visible' && !this.resource.isLoading()) {
          this.reload();
        }
      }, this.config.refreshIntervalMs);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
  }

  reload(): void {
    this.resource.reload();
  }

  /** Deep link into InvenTree, only when showing live data. */
  partUrl(partId: number): string | null {
    return this.source() === 'live' ? this.api.partUrl(partId) : null;
  }

  private load(): Observable<InventorySnapshot> {
    if (!this.api.isConfigured) {
      return of(buildSampleSnapshot('No InvenTree API URL is configured.'));
    }

    return forkJoin({
      parts: this.api.getParts(),
      categories: this.api.getCategories(),
      stock: this.api.getStockItems(),
    }).pipe(
      timeout(this.config.timeoutMs),
      map((raw): InventorySnapshot => ({
        source: 'live',
        notice: null,
        syncedAt: new Date().toISOString(),
        ...mapInvenTreeData(raw, (path) => this.api.resolveMediaUrl(path)),
        // Parts/stock endpoints carry no order or flow history; keep sample series for those widgets.
        ...sampleOperationalData(),
      })),
      catchError((error: unknown) => of(buildSampleSnapshot(describeError(error)))),
    );
  }
}

function describeError(error: unknown): string {
  if (error instanceof TimeoutError) {
    return 'InvenTree did not respond in time.';
  }
  if (error instanceof HttpErrorResponse) {
    const detail = (error.error as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string') return detail;
    if (error.status === 0) return 'InvenTree is unreachable (network or CORS).';
    if (error.status === 401 || error.status === 403) return 'InvenTree rejected the API token.';
    return `InvenTree returned HTTP ${error.status}.`;
  }
  return 'InvenTree data could not be loaded.';
}
