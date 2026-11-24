import { Component, input } from '@angular/core';

let nextPanelId = 0;

/** Card shell shared by every dashboard widget: heading, optional actions slot, body. */
@Component({
  selector: 'app-panel',
  template: `
    <section
      class="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm"
      [attr.aria-labelledby]="headingId"
    >
      <header class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 [id]="headingId" class="text-base font-semibold text-ink">{{ heading() }}</h2>
          @if (subheading()) {
            <p class="mt-0.5 text-sm text-ink-subtle">{{ subheading() }}</p>
          }
        </div>
        <ng-content select="[panelActions]" />
      </header>
      <div class="min-h-0 flex-1">
        <ng-content />
      </div>
    </section>
  `,
  host: { class: 'block min-w-0' },
})
export class PanelComponent {
  readonly heading = input.required<string>();
  readonly subheading = input<string>();
  protected readonly headingId = `panel-heading-${nextPanelId++}`;
}
