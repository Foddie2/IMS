import { DOCUMENT, DecimalPipe, NgOptimizedImage } from '@angular/common';
import {
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { InventoryItem } from '../../../core/models/inventory.models';
import { AuthService } from '../../../core/services/auth.service';
import { InventoryFilterStore } from '../../../core/services/inventory-filter.store';
import { InventoryService } from '../../../core/services/inventory.service';
import { BarcodeComponent } from '../../../shared/components/barcode.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { StatusIndicatorComponent } from '../../../shared/components/status-indicator.component';
import { InventoryEmptyStateComponent } from './inventory-empty-state.component';
import { InventoryFiltersComponent } from './inventory-filters.component';
import { ItemDetailsDialogComponent, PLACEHOLDER_IMAGE } from './item-details-dialog.component';
import { RowActionsMenuComponent } from './row-actions-menu.component';

const PAGE_SIZE = 8;

@Component({
  selector: 'app-inventory-table',
  imports: [
    BarcodeComponent,
    DecimalPipe,
    IconComponent,
    InventoryEmptyStateComponent,
    InventoryFiltersComponent,
    ItemDetailsDialogComponent,
    NgOptimizedImage,
    RowActionsMenuComponent,
    StatusIndicatorComponent,
  ],
  template: `
    <section class="rounded-2xl border border-line bg-surface shadow-sm" aria-labelledby="inventory-heading">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="inventory-heading" class="text-base font-semibold text-ink">Inventory Items</h2>
          <p class="mt-0.5 text-sm text-ink-muted" aria-live="polite">
            <span class="font-semibold text-ink tabular-nums">{{ store.filteredCount() | number }}</span>
            {{ store.filteredCount() === 1 ? 'product' : 'products' }}
            @if (store.hasActiveFilters()) {
              <span>matching filters (of {{ store.totalCount() | number }})</span>
            }
          </p>
        </div>

        <div class="flex items-center gap-2">
          @if (canEdit() && selectedCount() > 0) {
            <span class="text-sm text-ink-muted">{{ selectedCount() }} selected</span>
            <button
              type="button"
              class="rounded-lg px-2 py-1 text-sm font-medium text-accent-ink hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-blue-600"
              (click)="selected.set(emptySelection)"
            >
              Clear
            </button>
          }
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink-secondary shadow-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            aria-controls="inventory-filter-panel"
            [attr.aria-expanded]="filtersOpen()"
            (click)="filtersOpen.update((open) => !open)"
          >
            <app-icon name="filter" class="size-4" />
            Filter item
            @if (store.activeFilterCount() > 0) {
              <span class="grid size-5 place-items-center rounded-full bg-blue-600 text-[11px] font-semibold text-white">
                {{ store.activeFilterCount() }}<span class="sr-only"> active</span>
              </span>
            }
          </button>
        </div>
      </header>

      <div id="inventory-filter-panel" class="border-b border-line bg-surface-muted/60 px-5 py-4" [hidden]="!filtersOpen()">
        <app-inventory-filters [categories]="inventory.categories()" />
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-260 text-left text-sm">
          <caption class="sr-only">Inventory items, page {{ page() }} of {{ pageCount() }}</caption>
          <thead class="bg-surface-muted text-xs font-semibold tracking-wide text-ink-muted uppercase">
            <tr>
              @if (canEdit()) {
              <th scope="col" class="w-12 py-3 pl-5">
                <input
                  #selectAll
                  type="checkbox"
                  class="size-4 cursor-pointer rounded border-line-strong accent-blue-600"
                  aria-label="Select all products on this page"
                  [checked]="allPageSelected()"
                  [indeterminate]="somePageSelected()"
                  [disabled]="pagedItems().length === 0"
                  (change)="toggleAll(selectAll.checked)"
                />
              </th>
              }
              <th scope="col" class="px-3 py-3">Product Name</th>
              <th scope="col" class="px-3 py-3">SKU</th>
              <th scope="col" class="px-3 py-3">Category</th>
              <th scope="col" class="px-3 py-3 text-right">Current Stock</th>
              <th scope="col" class="px-3 py-3">Status</th>
              <th scope="col" class="px-3 py-3">Barcode Data</th>
              <th scope="col" class="px-3 py-3">Image</th>
              <th scope="col" class="py-3 pr-5 pl-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line-subtle">
            @for (item of pagedItems(); track item.id) {
              <tr class="transition-colors hover:bg-surface-muted/80" [class.bg-accent-soft]="selected().has(item.id)">
                @if (canEdit()) {
                <td class="py-3 pl-5">
                  <input
                    type="checkbox"
                    class="size-4 cursor-pointer rounded border-line-strong accent-blue-600"
                    [attr.aria-label]="'Select ' + item.name"
                    [checked]="selected().has(item.id)"
                    (change)="toggleRow(item.id)"
                  />
                </td>
                }
                <td class="max-w-64 px-3 py-3">
                  <p class="truncate font-medium text-ink">{{ item.name }}</p>
                  <p class="truncate text-xs text-ink-subtle">{{ item.location }}</p>
                </td>
                <td class="px-3 py-3 font-mono text-xs text-ink-secondary">{{ item.sku }}</td>
                <td class="px-3 py-3">
                  <span class="rounded-md bg-surface-subtle px-2 py-1 text-xs font-medium whitespace-nowrap text-ink-secondary">{{ item.category }}</span>
                </td>
                <td class="px-3 py-3 text-right tabular-nums">
                  <span class="font-semibold text-ink">{{ item.stock | number }}</span>
                  <span class="block text-xs text-ink-subtle">min {{ item.minimumStock | number }}</span>
                </td>
                <td class="px-3 py-3"><app-status-indicator [status]="item.status" /></td>
                <td class="px-3 py-3"><app-barcode [value]="item.barcode" /></td>
                <td class="px-3 py-3">
                  <img
                    [ngSrc]="item.imageUrl ?? placeholder"
                    width="40"
                    height="40"
                    [alt]="item.name"
                    class="size-10 rounded-lg border border-line bg-surface-muted object-contain p-0.5"
                  />
                </td>
                <td class="py-3 pr-5 pl-3">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      class="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      (click)="viewItem(item)"
                    >
                      Action<span class="sr-only">: view {{ item.name }}</span>
                    </button>
                    <app-row-actions-menu
                      [item]="item"
                      (view)="viewItem(item)"
                      (copySku)="copySku(item)"
                    />
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="canEdit() ? 9 : 8">
                  @if (store.totalCount() === 0) {
                    <app-inventory-empty-state
                      heading="No products yet"
                      message="Products added in Supabase will appear here automatically."
                      [showReset]="false"
                    />
                  } @else {
                    <app-inventory-empty-state (resetRequested)="store.reset()" />
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (store.filteredCount() > 0) {
        <nav class="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm text-ink-muted" aria-label="Table pagination">
          <p>
            Showing <span class="font-semibold text-ink">{{ rangeStart() }}–{{ rangeEnd() }}</span>
            of <span class="font-semibold text-ink">{{ store.filteredCount() | number }}</span>
          </p>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="grid size-9 place-items-center rounded-lg border border-line-strong bg-surface hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              [disabled]="page() === 1"
              (click)="page.set(page() - 1)"
            >
              <app-icon name="chevron-left" class="size-4" />
              <span class="sr-only">Previous page</span>
            </button>
            <span class="px-2 tabular-nums">Page {{ page() }} of {{ pageCount() }}</span>
            <button
              type="button"
              class="grid size-9 place-items-center rounded-lg border border-line-strong bg-surface hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              [disabled]="page() === pageCount()"
              (click)="page.set(page() + 1)"
            >
              <app-icon name="chevron-right" class="size-4" />
              <span class="sr-only">Next page</span>
            </button>
          </div>
        </nav>
      }
    </section>

    <app-item-details-dialog
      [item]="detailItem()"
      [showFinance]="showFinance()"
      (closed)="detailItem.set(null)"
    />

    <div
      class="pointer-events-none fixed right-4 bottom-4 z-50 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-surface shadow-lg transition-opacity"
      [class.opacity-0]="!toast()"
      role="status"
    >
      {{ toast() }}
    </div>
  `,
  host: { id: 'inventory-items', class: 'block scroll-mt-20' },
})
export class InventoryTableComponent {
  protected readonly store = inject(InventoryFilterStore);
  protected readonly inventory = inject(InventoryService);
  protected readonly auth = inject(AuthService);
  /** RBAC: bulk selection needs edit rights. */
  protected readonly canEdit = computed(() => this.auth.can('inventory:edit'));
  /** RBAC: unit cost and stock value require finance access. */
  protected readonly showFinance = computed(() => this.auth.can('finance:view'));
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required(ItemDetailsDialogComponent);

  protected readonly placeholder = PLACEHOLDER_IMAGE;
  protected readonly emptySelection: ReadonlySet<number> = new Set();

  protected readonly filtersOpen = signal(true);
  protected readonly selected = signal<ReadonlySet<number>>(this.emptySelection);
  protected readonly detailItem = signal<InventoryItem | null>(null);
  protected readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  /** Jumps back to the first page whenever the filtered result set changes. */
  protected readonly page = linkedSignal({ source: this.store.filteredItems, computation: () => 1 });
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.store.filteredCount() / PAGE_SIZE)));
  protected readonly pagedItems = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.store.filteredItems().slice(start, start + PAGE_SIZE);
  });
  protected readonly rangeStart = computed(() => (this.page() - 1) * PAGE_SIZE + 1);
  protected readonly rangeEnd = computed(() => this.rangeStart() + this.pagedItems().length - 1);

  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly allPageSelected = computed(() => {
    const items = this.pagedItems();
    return items.length > 0 && items.every((item) => this.selected().has(item.id));
  });
  protected readonly somePageSelected = computed(
    () => !this.allPageSelected() && this.pagedItems().some((item) => this.selected().has(item.id)),
  );

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.toastTimer));
  }

  protected toggleAll(checked: boolean): void {
    const ids = this.pagedItems().map((item) => item.id);
    this.selected.update((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  protected toggleRow(id: number): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected viewItem(item: InventoryItem): void {
    this.detailItem.set(item);
    // Open after the dialog content has rendered so the browser can focus inside it.
    afterNextRender(() => this.dialog().open(), { injector: this.injector });
  }

  protected async copySku(item: InventoryItem): Promise<void> {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    try {
      await clipboard?.writeText(item.sku);
      this.showToast(clipboard ? `Copied ${item.sku}` : `SKU: ${item.sku}`);
    } catch {
      this.showToast(`SKU: ${item.sku}`);
    }
  }

  private showToast(message: string): void {
    clearTimeout(this.toastTimer);
    this.toast.set(message);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2500);
  }
}
