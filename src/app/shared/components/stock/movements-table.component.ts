import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { StockMovementDto, StockMovementType } from '../../../core/models/api.models';

const TYPE_STYLES: Record<StockMovementType, string> = {
  Inbound: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  Outbound: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  Adjustment: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  Transfer: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};

/** Read-only list of stock movements (inventory history, shipments). */
@Component({
  selector: 'app-movements-table',
  imports: [DatePipe, DecimalPipe],
  template: `
    <div class="overflow-x-auto">
      <table class="data-table min-w-[760px]">
        <caption class="sr-only">{{ caption() }}</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Product</th>
            <th scope="col">Warehouse</th>
            <th scope="col">Type</th>
            <th scope="col" class="text-right">Quantity</th>
            <th scope="col">Reference</th>
            <th scope="col">By</th>
          </tr>
        </thead>
        <tbody>
          @for (m of movements(); track m.id) {
            <tr>
              <td class="whitespace-nowrap">
                <time [attr.datetime]="m.createdAt">{{ m.createdAt | date: 'MMM d, y · HH:mm' }}</time>
              </td>
              <td>
                <span class="block font-medium text-ink">{{ m.productName }}</span>
                <span class="font-mono text-xs text-ink-subtle">{{ m.productSku }}</span>
              </td>
              <td class="whitespace-nowrap">{{ m.warehouseName }}</td>
              <td>
                <span class="rounded-sm px-2 py-0.5 text-xs font-semibold" [class]="typeStyles[m.type]">{{ m.type }}</span>
              </td>
              <td class="text-right font-semibold tabular-nums" [class]="m.quantityDelta > 0 ? 'text-good-ink' : 'text-bad-ink'">
                {{ m.quantityDelta > 0 ? '+' : '' }}{{ m.quantityDelta | number }}
              </td>
              <td class="font-mono text-xs">{{ m.referenceNumber ?? '—' }}</td>
              <td class="whitespace-nowrap">{{ m.performedByName ?? 'System' }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="py-10 text-center text-ink-subtle">{{ emptyMessage() }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class MovementsTableComponent {
  readonly movements = input.required<readonly StockMovementDto[]>();
  readonly caption = input('Stock movements');
  readonly emptyMessage = input('No stock movements yet.');
  protected readonly typeStyles = TYPE_STYLES;
}
