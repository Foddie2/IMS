import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon.component';

/** Placeholder for modules outside the dashboard demo scope. `breadcrumb` is bound from route data. */
@Component({
  selector: 'app-coming-soon',
  imports: [IconComponent, RouterLink],
  template: `
    <div class="mx-auto max-w-xl rounded-sm border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
      <span class="mx-auto mb-4 grid size-12 place-items-center rounded-sm bg-accent-soft text-accent-ink">
        <app-icon name="cube" class="size-6" />
      </span>
      <h1 class="text-xl font-bold text-ink">{{ breadcrumb() }}</h1>
      <p class="mt-2 text-sm text-ink-muted">This module is on the roadmap. The dashboard shows a live overview in the meantime.</p>
      <a
        routerLink="/dashboard"
        class="mt-6 inline-flex rounded-sm bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Back to dashboard
      </a>
    </div>
  `,
})
export class ComingSoonComponent {
  readonly breadcrumb = input('Coming soon');
}
