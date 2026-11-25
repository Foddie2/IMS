import { Component, inject } from '@angular/core';
import { ALL_SITES, SiteContextService } from '../../core/services/site-context.service';
import { IconComponent } from '../../shared/components/icon.component';

let nextId = 0;

/** Multi-site scope selector. Lists only the sites the current user may access. */
@Component({
  selector: 'app-site-switcher',
  imports: [IconComponent],
  template: `
    <label [for]="id" class="sr-only">Site</label>
    <div class="relative">
      <app-icon name="building" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
      <select
        #select
        [id]="id"
        class="h-10 w-full appearance-none rounded-sm border border-line bg-surface pr-9 pl-9 text-sm font-medium text-ink focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 focus:outline-none disabled:opacity-70"
        [disabled]="sites.accessibleSites().length <= 1"
        (change)="sites.select(select.value)"
      >
        @if (sites.accessibleSites().length !== 1) {
          <option [value]="all" [selected]="sites.selectedSiteId() === all">
            {{ sites.hasGlobalAccess() ? 'All sites' : 'All my sites' }}
          </option>
        }
        @for (site of sites.accessibleSites(); track site.id) {
          <option [value]="site.id" [selected]="sites.selectedSiteId() === site.id">{{ site.name }}</option>
        }
      </select>
      <app-icon name="chevron-down" class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-subtle" />
    </div>
  `,
  host: { class: 'block' },
})
export class SiteSwitcherComponent {
  protected readonly sites = inject(SiteContextService);
  protected readonly all = ALL_SITES;
  protected readonly id = `site-switcher-${nextId++}`;
}
