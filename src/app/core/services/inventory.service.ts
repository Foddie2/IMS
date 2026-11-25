import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InventorySnapshot } from '../models/inventory.models';
import { apiErrorMessage } from '../utils/api-error';
import { mapInventorySnapshot } from '../utils/inventory.mapper';
import { InventoryApiService, ReferenceDataService } from './api.services';
import { AuthService } from './auth.service';

/**
 * Inventory snapshot for every warehouse the signed-in user may access, loaded from
 * `GET /api/warehouses` + `GET /api/inventory`. Refreshes in the background while the
 * tab is visible, and on demand after any stock change (`reload()`).
 *
 * Site scoping and metrics live in `InventoryInsightsService`.
 */
@Service()
export class InventoryService {
  private readonly auth = inject(AuthService);
  private readonly reference = inject(ReferenceDataService);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Bumped on every successful load so dependent report data can refetch too. */
  readonly version = signal(0);

  private readonly resource = rxResource<InventorySnapshot, number | undefined>({
    // Per signed-in user (browser only); cleared on sign-out.
    params: () => (this.isBrowser ? (this.auth.userId() ?? undefined) : undefined),
    stream: () =>
      forkJoin({ warehouses: this.reference.warehouses(), inventory: this.inventoryApi.list() }).pipe(
        map(({ warehouses, inventory }) => {
          this.version.update((v) => v + 1);
          return mapInventorySnapshot(warehouses, inventory, new Date().toISOString());
        }),
      ),
  });

  readonly snapshot = computed(() => (this.resource.hasValue() ? this.resource.value() : null));
  readonly isLoading = computed(() => this.snapshot() === null && !this.resource.error());
  readonly isRefreshing = computed(() => this.snapshot() !== null && this.resource.isLoading());
  readonly error = computed(() => {
    const error = this.resource.error();
    return error ? apiErrorMessage(error, 'Inventory could not be loaded.') : null;
  });

  readonly syncedAt = computed(() => this.snapshot()?.syncedAt ?? null);
  readonly items = computed(() => this.snapshot()?.items ?? []);
  readonly categories = computed(() => this.snapshot()?.categories ?? []);
  readonly sites = computed(() => this.snapshot()?.sites ?? []);

  constructor() {
    const interval = environment.refreshIntervalMs;
    if (this.isBrowser && interval > 0) {
      const timer = setInterval(() => {
        if (this.document.visibilityState === 'visible' && this.auth.isAuthenticated() && !this.resource.isLoading()) {
          this.reload();
        }
      }, interval);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
  }

  reload(): void {
    this.resource.reload();
  }
}
