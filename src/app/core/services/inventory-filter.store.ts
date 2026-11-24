import { Service, computed, inject, signal } from '@angular/core';
import { StockStatus } from '../models/inventory.models';
import { InventoryInsightsService } from './inventory-insights.service';

export const ALL = 'all';

export interface InventoryFilters {
  /** Free-text match against product name or SKU. */
  query: string;
  /** Category name, or `'all'`. */
  category: string;
  status: StockStatus | typeof ALL;
}

export const DEFAULT_FILTERS: InventoryFilters = { query: '', category: ALL, status: ALL };

/**
 * App-wide filter state for the inventory table. Shared so the global search in
 * the top bar and the table toolbar drive the same results.
 */
@Service()
export class InventoryFilterStore {
  private readonly inventory = inject(InventoryInsightsService);

  /** Writable model – bound directly to Signal Forms via `form(store.filters)`. */
  readonly filters = signal<InventoryFilters>(DEFAULT_FILTERS);

  readonly filteredItems = computed(() => {
    const { query, category, status } = this.filters();
    const needle = query.trim().toLowerCase();

    return this.inventory.items().filter(
      (item) =>
        (!needle ||
          item.name.toLowerCase().includes(needle) ||
          item.sku.toLowerCase().includes(needle)) &&
        (category === ALL || item.category === category) &&
        (status === ALL || item.status === status),
    );
  });

  readonly totalCount = computed(() => this.inventory.items().length);
  readonly filteredCount = computed(() => this.filteredItems().length);

  readonly activeFilterCount = computed(() => {
    const { query, category, status } = this.filters();
    return [query.trim() !== '', category !== ALL, status !== ALL].filter(Boolean).length;
  });
  readonly hasActiveFilters = computed(() => this.activeFilterCount() > 0);

  setCategory(category: string): void {
    this.filters.update((f) => ({ ...f, category }));
  }

  setStatus(status: InventoryFilters['status']): void {
    this.filters.update((f) => ({ ...f, status }));
  }

  reset(): void {
    this.filters.set(DEFAULT_FILTERS);
  }
}
