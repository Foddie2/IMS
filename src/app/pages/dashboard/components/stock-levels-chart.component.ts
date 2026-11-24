import { Component, computed, input, output } from '@angular/core';
import { CategoryStockLevels, STOCK_STATUS_LABELS, StockStatus } from '../../../core/models/inventory.models';
import { PanelComponent } from '../../../shared/components/panel.component';
import { STATUS_STYLES } from '../../../shared/components/status-indicator.component';

const MAX_ROWS = 6;

@Component({
  selector: 'app-stock-levels-chart',
  imports: [PanelComponent],
  template: `
    <app-panel heading="Stock Levels Overview" subheading="SKUs per category by stock status">
      <ul class="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label="Legend">
        @for (s of legend; track s.status) {
          <li class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-sm" [style.background-color]="s.color" aria-hidden="true"></span>
            {{ s.label }}
            <span class="font-semibold text-ink tabular-nums">{{ totals()[s.status] }}</span>
          </li>
        }
      </ul>

      <ul class="space-y-3">
        @for (row of rows(); track row.category) {
          <li>
            <button
              type="button"
              class="group w-full rounded-lg p-1 -m-1 text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-blue-600"
              [attr.aria-label]="'Filter table by ' + row.category + ': ' + row.inStock + ' in stock, ' + row.lowStock + ' low stock, ' + row.outOfStock + ' out of stock'"
              (click)="categorySelected.emit(row.category)"
            >
              <span class="mb-1 flex items-center justify-between gap-2 text-xs">
                <span class="truncate font-medium text-ink-secondary">{{ row.category }}</span>
                <span class="text-ink-subtle tabular-nums">{{ row.total }} SKUs</span>
              </span>
              <span class="flex h-3 gap-0.5" [style.width.%]="(row.total / maxTotal()) * 100" aria-hidden="true">
                @for (seg of row.segments; track seg.status) {
                  @if (seg.count > 0) {
                    <span
                      class="h-full first:rounded-l-full last:rounded-r-full"
                      [style.flex-grow]="seg.count"
                      [style.background-color]="seg.color"
                      [title]="seg.label + ': ' + seg.count"
                    ></span>
                  }
                }
              </span>
            </button>
          </li>
        } @empty {
          <li class="text-sm text-ink-subtle">No stock data yet.</li>
        }
      </ul>
    </app-panel>
  `,
  host: { class: 'block' },
})
export class StockLevelsChartComponent {
  readonly data = input.required<readonly CategoryStockLevels[]>();
  readonly categorySelected = output<string>();

  protected readonly legend = (['in-stock', 'low-stock', 'out-of-stock'] as const).map((status) => ({
    status,
    label: STOCK_STATUS_LABELS[status],
    color: STATUS_STYLES[status].fill,
  }));

  protected readonly totals = computed(() => {
    const totals: Record<StockStatus, number> = { 'in-stock': 0, 'low-stock': 0, 'out-of-stock': 0 };
    for (const row of this.data()) {
      totals['in-stock'] += row.inStock;
      totals['low-stock'] += row.lowStock;
      totals['out-of-stock'] += row.outOfStock;
    }
    return totals;
  });

  protected readonly maxTotal = computed(() => Math.max(1, ...this.rows().map((r) => r.total)));

  protected readonly rows = computed(() =>
    this.data()
      .slice(0, MAX_ROWS)
      .map((row) => ({
        ...row,
        segments: [
          { status: 'in-stock', count: row.inStock },
          { status: 'low-stock', count: row.lowStock },
          { status: 'out-of-stock', count: row.outOfStock },
        ].map((s) => {
          const status = s.status as StockStatus;
          return { ...s, label: STOCK_STATUS_LABELS[status], color: STATUS_STYLES[status].fill };
        }),
      })),
  );
}
