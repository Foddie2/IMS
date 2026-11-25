import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { StockMovementResultDto } from '../../core/models/api.models';
import { STOCK_STATUSES, STOCK_STATUS_LABELS, StockStatus } from '../../core/models/inventory.models';
import { StockMovementService } from '../../core/services/api.services';
import { InventoryService } from '../../core/services/inventory.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusIndicatorComponent } from '../../shared/components/status-indicator.component';
import { MovementsTableComponent } from '../../shared/components/stock/movements-table.component';
import { StockMovementDialogComponent } from '../../shared/components/stock/stock-movement-dialog.component';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';

interface InventoryFilters {
  search: string;
  category: string;
  status: StockStatus | 'all';
}

/** Per-warehouse stock matrix + stock movements (all roles; Users see their assigned warehouses only). */
@Component({
  selector: 'app-inventory-page',
  imports: [
    DecimalPipe,
    FormField,
    HasRoleDirective,
    IconComponent,
    MovementsTableComponent,
    PageHeaderComponent,
    StatusIndicatorComponent,
    StockMovementDialogComponent,
  ],
  template: `
    <div class="mx-auto max-w-[1600px]">
      <app-page-header heading="Inventory" description="Stock on hand per warehouse. Record receipts, shipments, adjustments and transfers.">
        <button type="button" class="btn-primary" *appHasRole="['User', 'Admin', 'SuperAdmin']" (click)="dialog().open()">
          <app-icon name="adjusted" class="size-4" /> Record movement
        </button>
      </app-page-header>

      <section class="rounded-sm border border-line bg-surface shadow-sm" aria-labelledby="stock-heading">
        <div class="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-end">
          <h2 id="stock-heading" class="sr-only">Stock by warehouse</h2>
          <div class="flex-1 lg:max-w-xs">
            <label for="inv-search" class="form-label text-xs">Search</label>
            <div class="relative">
              <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
              <input id="inv-search" type="search" class="form-input pl-9" placeholder="Name or SKU" [formField]="filterForm.search" />
            </div>
          </div>
          <div class="lg:w-56">
            <label for="inv-category" class="form-label text-xs">Category</label>
            <select id="inv-category" class="form-input" [formField]="filterForm.category">
              <option value="all">All categories</option>
              @for (c of inventory.categories(); track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
          </div>
          <div class="lg:w-48">
            <label for="inv-status" class="form-label text-xs">Stock status</label>
            <select id="inv-status" class="form-input" [formField]="filterForm.status">
              <option value="all">All statuses</option>
              @for (s of statuses; track s) {
                <option [value]="s">{{ statusLabels[s] }}</option>
              }
            </select>
          </div>
          <p class="text-sm text-ink-muted lg:ml-auto" aria-live="polite">
            <span class="font-semibold text-ink tabular-nums">{{ rows().length }}</span> of {{ inventory.items().length }} products
          </p>
        </div>

        @if (inventory.error(); as message) {
          <p class="px-5 py-10 text-center text-sm text-bad-ink" role="alert">{{ message }}</p>
        } @else if (inventory.isLoading()) {
          <p class="px-5 py-10 text-center text-sm text-ink-subtle" role="status">Loading stock…</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="data-table min-w-[760px]">
              <caption class="sr-only">Stock by product and warehouse</caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  @for (site of inventory.sites(); track site.id) {
                    <th scope="col" class="text-right whitespace-nowrap">{{ site.name }}</th>
                  }
                  <th scope="col" class="text-right">Total</th>
                  <th scope="col">Status</th>
                  <th scope="col" class="text-right"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (item of rows(); track item.id) {
                  <tr>
                    <td>
                      <span class="block font-medium text-ink">{{ item.name }}</span>
                      <span class="font-mono text-xs text-ink-subtle">{{ item.sku }}</span>
                    </td>
                    <td class="whitespace-nowrap">{{ item.category }}</td>
                    @for (site of inventory.sites(); track site.id) {
                      <td class="text-right tabular-nums" [class.text-ink-faint]="!item.stockBySite[site.id]">
                        {{ item.stockBySite[site.id] ?? 0 | number }}
                      </td>
                    }
                    <td class="text-right font-semibold text-ink tabular-nums">
                      {{ item.stock | number }}
                      <span class="block text-xs font-normal text-ink-subtle">min {{ item.minimumStock | number }}</span>
                    </td>
                    <td><app-status-indicator [status]="item.status" /></td>
                    <td class="text-right">
                      <button
                        type="button"
                        class="rounded-sm px-2.5 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-blue-600"
                        (click)="dialog().open({ productId: item.id })"
                      >
                        Move<span class="sr-only"> stock of {{ item.name }}</span>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="inventory.sites().length + 5" class="py-10 text-center text-ink-subtle">
                      No products match these filters.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <section class="mt-6 rounded-sm border border-line bg-surface shadow-sm" aria-labelledby="movements-heading">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id="movements-heading" class="text-base font-semibold text-ink">Recent movements</h2>
          @if (movements.isLoading()) {
            <span class="text-xs text-ink-subtle" role="status">Updating…</span>
          }
        </header>
        <app-movements-table [movements]="(movements.hasValue() ? movements.value() : [])" caption="Most recent stock movements" />
      </section>
    </div>

    <app-stock-movement-dialog [items]="inventory.items()" [sites]="inventory.sites()" (recorded)="onRecorded($event)" />
  `,
})
export class InventoryPageComponent {
  protected readonly inventory = inject(InventoryService);
  private readonly movementApi = inject(StockMovementService);
  private readonly toast = inject(ToastService);

  protected readonly dialog = viewChild.required(StockMovementDialogComponent);
  protected readonly statuses = STOCK_STATUSES;
  protected readonly statusLabels = STOCK_STATUS_LABELS;

  private readonly filters = signal<InventoryFilters>({ search: '', category: 'all', status: 'all' });
  protected readonly filterForm = form(this.filters);

  protected readonly rows = computed(() => {
    const { search, category, status } = this.filters();
    const needle = search.trim().toLowerCase();
    return this.inventory.items().filter(
      (i) =>
        (!needle || i.name.toLowerCase().includes(needle) || i.sku.toLowerCase().includes(needle)) &&
        (category === 'all' || i.category === category) &&
        (status === 'all' || i.status === status),
    );
  });

  /** Refetches whenever the inventory snapshot reloads (e.g. after recording a movement). */
  protected readonly movements = rxResource({
    params: () => this.inventory.version() || undefined,
    stream: () => this.movementApi.list({ take: 25 }),
  });

  protected onRecorded(result: StockMovementResultDto): void {
    const first = result.movements[0];
    const verb = first?.type === 'Transfer' ? 'Transferred' : first?.type === 'Outbound' ? 'Shipped' : 'Recorded';
    this.toast.success(`${verb} ${Math.abs(first?.quantityDelta ?? 0)} × ${first?.productName ?? 'item'}.`);
    this.inventory.reload();
  }
}
