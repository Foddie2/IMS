import { Component, inject, input } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { STOCK_STATUS_LABELS, STOCK_STATUSES } from '../../../core/models/inventory.models';
import { ALL, InventoryFilterStore } from '../../../core/services/inventory-filter.store';
import { IconComponent } from '../../../shared/components/icon.component';

/** Search, category and status filters – a Signal Form bound to the shared filter store. */
@Component({
  selector: 'app-inventory-filters',
  imports: [FormField, IconComponent],
  template: `
    <form class="flex flex-col gap-3 lg:flex-row lg:items-end" (submit)="$event.preventDefault()">
      <div class="flex-1 lg:max-w-xs">
        <label for="filter-query" class="mb-1 block text-xs font-medium text-ink-muted">Search</label>
        <div class="relative">
          <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            id="filter-query"
            type="search"
            autocomplete="off"
            placeholder="Name or SKU"
            class="h-10 w-full rounded-sm border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-subtle focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 focus:outline-none"
            [formField]="filterForm.query"
          />
        </div>
      </div>

      <div class="lg:w-56">
        <label for="filter-category" class="mb-1 block text-xs font-medium text-ink-muted">Category</label>
        <div class="relative">
          <select
            id="filter-category"
            class="h-10 w-full appearance-none rounded-sm border border-line-strong bg-surface pr-9 pl-3 text-sm text-ink focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 focus:outline-none"
            [formField]="filterForm.category"
          >
            <option [value]="all">All categories</option>
            @for (category of categories(); track category) {
              <option [value]="category">{{ category }}</option>
            }
          </select>
          <app-icon name="chevron-down" class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-subtle" />
        </div>
      </div>

      <fieldset>
        <legend class="mb-1 block text-xs font-medium text-ink-muted">Stock status</legend>
        <div class="flex flex-wrap gap-1 rounded-sm bg-surface-subtle p-1">
          @for (option of statusOptions; track option.value) {
            <label
              class="relative cursor-pointer rounded-sm px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink has-[:checked]:bg-surface has-[:checked]:text-ink has-[:checked]:shadow-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-600"
            >
              <input type="radio" class="sr-only" [value]="option.value" [formField]="filterForm.status" />
              @if (option.dot) {
                <span class="mr-1.5 inline-block size-2 rounded-full" [class]="option.dot" aria-hidden="true"></span>
              }
              {{ option.label }}
            </label>
          }
        </div>
      </fieldset>

      <button
        type="button"
        class="inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-secondary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 lg:ml-auto"
        [disabled]="!store.hasActiveFilters()"
        (click)="store.reset()"
      >
        <app-icon name="reset" class="size-4" />
        Reset filters
      </button>
    </form>
  `,
})
export class InventoryFiltersComponent {
  protected readonly store = inject(InventoryFilterStore);
  readonly categories = input.required<readonly string[]>();

  protected readonly all = ALL;
  protected readonly filterForm = form(this.store.filters);
  protected readonly statusOptions = [
    { value: ALL, label: 'All', dot: null },
    ...STOCK_STATUSES.map((status) => ({
      value: status,
      label: STOCK_STATUS_LABELS[status],
      dot:
        status === 'in-stock' ? 'bg-[#0ca30c]' : status === 'low-stock' ? 'bg-[#fab219]' : 'bg-[#d03b3b]',
    })),
  ];
}
