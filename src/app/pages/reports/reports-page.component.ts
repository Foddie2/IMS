import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { InventoryApiService, ReportService } from '../../core/services/api.services';
import { InventoryService } from '../../core/services/inventory.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { toStockStatus } from '../../core/utils/inventory.mapper';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusIndicatorComponent } from '../../shared/components/status-indicator.component';

/** Inventory summary, category breakdown, low-stock and audit log (Admin and SuperAdmin). */
@Component({
  selector: 'app-reports-page',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, PageHeaderComponent, PercentPipe, StatusIndicatorComponent],
  template: `
    <div class="mx-auto max-w-[1600px] space-y-6">
      <app-page-header heading="Reports" description="Stock valuation, re-order needs and a full audit trail across all warehouses." />

      @if (summary.error(); as error) {
        <p class="rounded-sm border border-line bg-surface px-5 py-10 text-center text-sm text-bad-ink" role="alert">{{ message(error) }}</p>
      } @else if (summary.value(); as s) {
        <section aria-label="Totals" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          @for (kpi of kpis(); track kpi.label) {
            <div class="rounded-sm border border-line bg-surface p-5 shadow-sm">
              <p class="text-sm text-ink-muted">{{ kpi.label }}</p>
              <p class="mt-2 text-2xl font-bold text-ink tabular-nums">{{ kpi.value }}</p>
            </div>
          }
        </section>

        <div class="grid gap-6 xl:grid-cols-2">
          <section class="rounded-sm border border-line bg-surface shadow-sm" aria-labelledby="cat-heading">
            <h2 id="cat-heading" class="border-b border-line px-5 py-4 text-base font-semibold text-ink">Stock by category</h2>
            <div class="overflow-x-auto">
              <table class="data-table">
                <caption class="sr-only">Units and value per category</caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col" class="text-right">SKUs</th>
                    <th scope="col" class="text-right">Units</th>
                    <th scope="col" class="text-right">Value</th>
                    <th scope="col" class="text-right">Share of value</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of s.categoryBreakdown; track c.categoryName) {
                    <tr>
                      <td class="font-medium text-ink">{{ c.categoryName }}</td>
                      <td class="text-right tabular-nums">{{ c.productCount }}</td>
                      <td class="text-right tabular-nums">{{ c.units | number }}</td>
                      <td class="text-right tabular-nums">{{ c.value | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
                      <td class="text-right tabular-nums">{{ (c.value ?? 0) / (s.totalStockValue || 1) | percent: '1.0-1' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <section class="rounded-sm border border-line bg-surface shadow-sm" aria-labelledby="low-heading">
            <h2 id="low-heading" class="border-b border-line px-5 py-4 text-base font-semibold text-ink">Re-order needed</h2>
            <div class="overflow-x-auto">
              <table class="data-table">
                <caption class="sr-only">Products at or below minimum stock</caption>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col" class="text-right">On hand</th>
                    <th scope="col" class="text-right">Minimum</th>
                    <th scope="col" class="text-right">Shortfall</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of (lowStock.hasValue() ? lowStock.value() : []); track item.productId) {
                    <tr>
                      <td><span class="block font-medium text-ink">{{ item.name }}</span><span class="font-mono text-xs text-ink-subtle">{{ item.sku }}</span></td>
                      <td class="text-right tabular-nums">{{ item.totalQuantity | number }}</td>
                      <td class="text-right tabular-nums">{{ item.minimumStock | number }}</td>
                      <td class="text-right font-semibold text-bad-ink tabular-nums">{{ item.shortfall | number }}</td>
                      <td><app-status-indicator [status]="toStatus(item.stockStatus)" /></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="py-10 text-center text-ink-subtle">Everything is above its re-order point.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        </div>
      } @else {
        <p class="text-sm text-ink-subtle" role="status">Loading reports…</p>
      }

      <section class="rounded-sm border border-line bg-surface shadow-sm" aria-labelledby="audit-heading">
        <h2 id="audit-heading" class="border-b border-line px-5 py-4 text-base font-semibold text-ink">Audit log <span class="text-sm font-normal text-ink-subtle">(latest 100)</span></h2>
        @if (audit.error(); as error) {
          <p class="px-5 py-10 text-center text-sm text-bad-ink" role="alert">{{ message(error) }}</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="data-table min-w-[860px]">
              <caption class="sr-only">Audit log entries</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">User</th>
                  <th scope="col">Action</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                @for (a of (audit.hasValue() ? audit.value() : []); track a.id) {
                  <tr>
                    <td class="whitespace-nowrap"><time [attr.datetime]="a.timestamp">{{ a.timestamp | date: 'MMM d, y · HH:mm:ss' }}</time></td>
                    <td class="whitespace-nowrap">{{ a.userName ?? '—' }}</td>
                    <td class="font-medium text-ink">{{ a.action }}</td>
                    <td class="whitespace-nowrap">{{ a.entityName }}{{ a.entityId ? ' #' + a.entityId : '' }}</td>
                    <td class="max-w-md truncate font-mono text-xs" [title]="a.details ?? ''">{{ a.details ?? '' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="py-10 text-center text-ink-subtle">No audit entries yet.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
})
export class ReportsPageComponent {
  private readonly reports = inject(ReportService);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly inventory = inject(InventoryService);

  /** 0 until the first inventory load (and always on the server) → resources stay idle. */
  private readonly version = computed(() => this.inventory.version() || undefined);
  protected readonly summary = rxResource({ params: () => this.version(), stream: () => this.reports.inventorySummary() });
  protected readonly lowStock = rxResource({ params: () => this.version(), stream: () => this.inventoryApi.lowStock() });
  protected readonly audit = rxResource({ params: () => this.version(), stream: () => this.reports.auditLogs(100) });

  protected readonly toStatus = toStockStatus;

  protected readonly kpis = computed(() => {
    const s = this.summary.value();
    if (!s) return [];
    const number = new Intl.NumberFormat('en-US');
    const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    return [
      { label: 'Units on hand', value: number.format(s.totalItems) },
      { label: 'Stock value', value: s.totalStockValue === null ? '—' : money.format(s.totalStockValue) },
      { label: 'Low stock SKUs', value: number.format(s.lowStockCount) },
      { label: 'Out of stock SKUs', value: number.format(s.outOfStockCount) },
    ];
  });

  protected message(error: unknown): string {
    return apiErrorMessage(error, 'This report could not be loaded.');
  }
}
