import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight text-ink">{{ heading() }}</h1>
        @if (description()) {
          <p class="mt-1 text-sm text-ink-muted">{{ description() }}</p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <ng-content />
      </div>
    </header>
  `,
  host: { class: 'block' },
})
export class PageHeaderComponent {
  readonly heading = input.required<string>();
  readonly description = input<string>();
}
