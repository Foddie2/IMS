import { Component, computed, input } from '@angular/core';
import { STOCK_STATUS_LABELS, StockStatus } from '../../core/models/inventory.models';

/** Status colours: the dot uses the status hue, the text a darker step that meets 4.5:1. */
export const STATUS_STYLES: Record<StockStatus, { dot: string; text: string; fill: string }> = {
  'in-stock': { dot: 'bg-[#0ca30c]', text: 'text-good-ink', fill: '#0ca30c' },
  'low-stock': { dot: 'bg-[#fab219]', text: 'text-warn-ink', fill: '#fab219' },
  'out-of-stock': { dot: 'bg-[#d03b3b]', text: 'text-bad-ink', fill: '#d03b3b' },
};

@Component({
  selector: 'app-status-indicator',
  template: `
    <span class="inline-flex items-center gap-2 text-sm font-medium whitespace-nowrap" [class]="style().text">
      <span class="size-2 rounded-full" [class]="style().dot" aria-hidden="true"></span>
      {{ label() }}
    </span>
  `,
})
export class StatusIndicatorComponent {
  readonly status = input.required<StockStatus>();
  protected readonly style = computed(() => STATUS_STYLES[this.status()]);
  protected readonly label = computed(() => STOCK_STATUS_LABELS[this.status()]);
}
