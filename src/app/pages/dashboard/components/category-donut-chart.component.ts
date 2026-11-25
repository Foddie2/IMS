import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { CategoryShare } from '../../../core/models/inventory.models';
import { PanelComponent } from '../../../shared/components/panel.component';

/** r chosen so the circumference is exactly 100 – dash lengths are then percentages. */
const RADIUS = 15.9155;
const GAP = 0.8;

@Component({
  selector: 'app-category-donut-chart',
  imports: [DecimalPipe, PercentPipe, PanelComponent],
  template: `
    <app-panel heading="Stock Distribution by Category" subheading="Share of units on hand">
      <div class="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
        <div class="relative size-44 shrink-0">
          <svg viewBox="0 0 42 42" class="size-full -rotate-90" aria-hidden="true">
            <circle cx="21" cy="21" [attr.r]="radius" fill="none" class="stroke-surface-subtle" stroke-width="5" />
            @for (seg of segments(); track seg.name) {
              <circle
                cx="21"
                cy="21"
                [attr.r]="radius"
                fill="none"
                [style.stroke]="seg.color"
                [attr.stroke-width]="active() === seg.name ? 6.5 : 5"
                [attr.stroke-dasharray]="seg.dash"
                [attr.stroke-dashoffset]="seg.offset"
                [style.opacity]="active() && active() !== seg.name ? 0.35 : 1"
                class="cursor-pointer transition-[opacity,stroke-width] duration-150"
                (pointerenter)="active.set(seg.name)"
                (pointerleave)="active.set(null)"
              />
            }
          </svg>
          <div class="pointer-events-none absolute inset-0 grid place-content-center text-center">
            @if (activeShare(); as s) {
              <span class="text-2xl font-bold text-ink tabular-nums">{{ s.share | percent: '1.0-1' }}</span>
              <span class="max-w-24 truncate text-xs text-ink-subtle">{{ s.name }}</span>
            } @else {
              <span class="text-2xl font-bold text-ink tabular-nums">{{ total() | number }}</span>
              <span class="text-xs text-ink-subtle">units</span>
            }
          </div>
        </div>

        <ul class="w-full space-y-1" aria-label="Categories">
          @for (seg of segments(); track seg.name) {
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-default disabled:hover:bg-transparent"
                [class.bg-surface-muted]="active() === seg.name"
                [disabled]="seg.name === 'Other'"
                [attr.aria-label]="seg.name === 'Other' ? null : 'Filter table by ' + seg.name + ', ' + (seg.share | percent: '1.0-1') + ' of units'"
                (pointerenter)="active.set(seg.name)"
                (pointerleave)="active.set(null)"
                (focus)="active.set(seg.name)"
                (blur)="active.set(null)"
                (click)="categorySelected.emit(seg.name)"
              >
                <span class="size-2.5 shrink-0 rounded-full" [style.background-color]="seg.color" aria-hidden="true"></span>
                <span class="min-w-0 flex-1 truncate text-ink-secondary">{{ seg.name }}</span>
                <span class="text-ink-subtle tabular-nums">{{ seg.units | number }}</span>
                <span class="w-12 text-right font-semibold text-ink tabular-nums">{{ seg.share | percent: '1.0-0' }}</span>
              </button>
            </li>
          }
        </ul>
      </div>
    </app-panel>
  `,
  host: { class: 'block' },
})
export class CategoryDonutChartComponent {
  readonly data = input.required<readonly CategoryShare[]>();
  readonly categorySelected = output<string>();

  protected readonly radius = RADIUS;
  protected readonly active = signal<string | null>(null);

  protected readonly total = computed(() => this.data().reduce((sum, s) => sum + s.units, 0));
  protected readonly activeShare = computed(() => this.data().find((s) => s.name === this.active()) ?? null);

  protected readonly segments = computed(() => {
    let cumulative = 0;
    return this.data().map((share) => {
      const length = share.share * 100;
      const visible = Math.max(length - GAP, 0.01);
      const segment = {
        ...share,
        dash: `${visible} ${100 - visible}`,
        offset: -cumulative,
      };
      cumulative += length;
      return segment;
    });
  });
}
