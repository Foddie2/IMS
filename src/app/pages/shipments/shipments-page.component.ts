import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { StockMovementType } from '../../core/models/api.models';
import { StockMovementService } from '../../core/services/api.services';
import { InventoryService } from '../../core/services/inventory.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { MovementsTableComponent } from '../../shared/components/stock/movements-table.component';

interface ShipmentFilters {
  type: StockMovementType | 'all';
  warehouseId: string;
}

/** Outbound shipments and transfers, filtered server-side by type and warehouse. */
@Component({
  selector: 'app-shipments-page',
  imports: [FormField, MovementsTableComponent, PageHeaderComponent],
  template: `
    <div class="mx-auto max-w-[1600px]">
      <app-page-header heading="Shipments" description="Goods leaving your warehouses and transfers between them." />

      <section class="rounded-sm border border-line bg-surface shadow-sm" aria-label="Shipments">
        <div class="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-end">
          <div class="sm:w-48">
            <label for="sh-type" class="form-label text-xs">Type</label>
            <select id="sh-type" class="form-input" [formField]="filterForm.type">
              <option value="Outbound">Outbound shipments</option>
              <option value="Transfer">Transfers</option>
              <option value="all">All movements</option>
            </select>
          </div>
          <div class="sm:w-56">
            <label for="sh-warehouse" class="form-label text-xs">Warehouse</label>
            <select id="sh-warehouse" class="form-input" [formField]="filterForm.warehouseId">
              <option value="">All my warehouses</option>
              @for (site of inventory.sites(); track site.id) {
                <option [value]="site.id">{{ site.name }}</option>
              }
            </select>
          </div>
          @if (movements.isLoading()) {
            <span class="text-xs text-ink-subtle sm:ml-auto" role="status">Loading…</span>
          }
        </div>

        @if (movements.error(); as error) {
          <p class="px-5 py-10 text-center text-sm text-bad-ink" role="alert">{{ errorMessage(error) }}</p>
        } @else {
          <app-movements-table
            [movements]="(movements.hasValue() ? movements.value() : [])"
            caption="Shipments and transfers"
            emptyMessage="No movements of this type yet."
          />
        }
      </section>
    </div>
  `,
})
export class ShipmentsPageComponent {
  protected readonly inventory = inject(InventoryService);
  private readonly api = inject(StockMovementService);

  private readonly filters = signal<ShipmentFilters>({ type: 'Outbound', warehouseId: '' });
  protected readonly filterForm = form(this.filters);

  protected readonly movements = rxResource({
    params: () => {
      const version = this.inventory.version();
      return version ? { ...this.filters(), version } : undefined;
    },
    stream: ({ params }) =>
      this.api.list({
        type: params.type === 'all' ? null : params.type,
        warehouseId: params.warehouseId ? Number(params.warehouseId) : null,
        take: 200,
      }),
  });

  protected errorMessage(error: unknown): string {
    return apiErrorMessage(error, 'Shipments could not be loaded.');
  }
}
