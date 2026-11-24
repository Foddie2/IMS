import { Component, input, output } from '@angular/core';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-inventory-empty-state',
  imports: [IconComponent],
  template: `
    <div class="mx-auto flex max-w-sm flex-col items-center px-6 py-14 text-center">
      <svg viewBox="0 0 160 120" class="mb-5 h-28 w-36" aria-hidden="true">
        <ellipse cx="80" cy="108" rx="52" ry="6" class="fill-line" />
        <path d="M40 46 80 28l40 18v44l-40 18-40-18V46Z" class="fill-accent-soft stroke-blue-300 dark:stroke-blue-700" stroke-width="2" stroke-linejoin="round" />
        <path d="m40 46 40 18 40-18M80 64v44" fill="none" class="stroke-blue-300 dark:stroke-blue-700" stroke-width="2" stroke-linejoin="round" />
        <path d="m60 37 40 18" class="stroke-map-dot" stroke-width="2" />
        <circle cx="114" cy="34" r="16" class="fill-surface" stroke="#2a78d6" stroke-width="3" />
        <path d="m126 46 12 12" stroke="#2a78d6" stroke-width="4" stroke-linecap="round" />
        <path d="m108 28 12 12m0-12-12 12" class="stroke-ink-faint" stroke-width="2.5" stroke-linecap="round" />
      </svg>
      <h3 class="text-base font-semibold text-ink">{{ heading() }}</h3>
      <p class="mt-1 text-sm text-ink-muted">{{ message() }}</p>
      @if (showReset()) {
        <button
          type="button"
          class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          (click)="resetRequested.emit()"
        >
          <app-icon name="reset" class="size-4" />
          Reset filters
        </button>
      }
    </div>
  `,
})
export class InventoryEmptyStateComponent {
  readonly heading = input('No products match your filters');
  readonly message = input('Try a different name or SKU, or broaden the category and stock status filters.');
  readonly showReset = input(true);
  readonly resetRequested = output();
}
