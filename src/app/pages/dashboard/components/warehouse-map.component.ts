import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { SiteWithStock } from '../../../core/models/inventory.models';
import { PanelComponent } from '../../../shared/components/panel.component';

/**
 * Map placeholder: a dotted canvas with positioned pins. Swap the canvas for
 * Leaflet / MapLibre when a tile provider is available – pins already carry x/y.
 * Pins double as a site picker for the multi-site context.
 */
@Component({
  selector: 'app-warehouse-map',
  imports: [DecimalPipe, PanelComponent],
  template: `
    <app-panel heading="Warehouse Locations" [subheading]="subheading()">
      <div class="relative aspect-video overflow-hidden rounded-xl border border-line bg-linear-to-br from-map-from to-map-to">
        <svg class="absolute inset-0 size-full" aria-hidden="true">
          <defs>
            <pattern id="map-dots" width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.2" class="fill-map-dot" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#map-dots)" />
          <line x1="0" y1="33%" x2="100%" y2="33%" class="stroke-map-dot" stroke-dasharray="4 6" />
          <line x1="0" y1="66%" x2="100%" y2="66%" class="stroke-map-dot" stroke-dasharray="4 6" />
        </svg>

        @for (site of sites(); track site.id) {
          <button
            type="button"
            class="group absolute -translate-x-1/2 -translate-y-full rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            [style.left.%]="site.x"
            [style.top.%]="site.y"
            [attr.aria-label]="'Show only ' + site.name + ', ' + site.city + ': ' + (site.units | number) + ' units'"
            [attr.aria-pressed]="selectedId() === site.id"
            (click)="siteSelected.emit(selectedId() === site.id ? null : site.id)"
          >
            <span class="relative grid place-items-center">
              @if (selectedId() === site.id) {
                <span class="absolute bottom-0 size-4 translate-y-1 animate-ping rounded-full bg-blue-400/50" aria-hidden="true"></span>
              }
              <svg viewBox="0 0 24 30" class="h-8 w-7 drop-shadow-md transition-transform group-hover:-translate-y-0.5" aria-hidden="true">
                <path
                  d="M12 1C6.2 1 1.5 5.6 1.5 11.3 1.5 19 12 29 12 29s10.5-10 10.5-17.7C22.5 5.6 17.8 1 12 1Z"
                  [attr.fill]="selectedId() === site.id ? '#1d4ed8' : '#2a78d6'"
                  [attr.opacity]="selectedId() && selectedId() !== site.id ? 0.55 : 1"
                  stroke="#fff"
                  stroke-width="1.5"
                />
                <circle cx="12" cy="11.5" r="4" fill="#fff" />
              </svg>
            </span>
          </button>
        } @empty {
          <p class="absolute inset-0 grid place-items-center text-sm text-ink-subtle">No sites available.</p>
        }
      </div>

      <ul class="mt-4 space-y-2 text-sm">
        @for (site of topSites(); track site.id) {
          <li class="flex items-center gap-2">
            <span class="size-2 rounded-full" [class]="selectedId() === site.id ? 'bg-blue-700' : 'bg-series-1'" aria-hidden="true"></span>
            <span class="min-w-0 flex-1 truncate text-ink-secondary" [class.font-semibold]="selectedId() === site.id">{{ site.name }}</span>
            <span class="font-semibold text-ink tabular-nums">{{ site.units | number }}</span>
          </li>
        }
      </ul>
    </app-panel>
  `,
  host: { class: 'block' },
})
export class WarehouseMapComponent {
  readonly sites = input.required<readonly SiteWithStock[]>();
  /** Currently selected site id, or `null` for all accessible sites. */
  readonly selectedId = input<string | null>(null);
  readonly siteSelected = output<string | null>();

  protected readonly subheading = computed(() => {
    const count = this.sites().length;
    return `${count} ${count === 1 ? 'site' : 'sites'} · select a pin to focus`;
  });

  protected readonly topSites = computed(() =>
    [...this.sites()].sort((a, b) => b.units - a.units).slice(0, 3),
  );
}
