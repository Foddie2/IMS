import { Component, computed, input } from '@angular/core';
import { IconComponent, IconName } from '../../../shared/components/icon.component';
import { SparklineComponent } from '../../../shared/components/sparkline.component';

export type KpiVisual =
  | { kind: 'sparkline'; data: readonly number[]; color: string }
  | { kind: 'progress'; value: number; max: number; label: string }
  | { kind: 'none' };

@Component({
  selector: 'app-kpi-card',
  imports: [IconComponent, SparklineComponent],
  template: `
    <article class="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-medium text-ink-muted">{{ label() }}</h3>
        <span class="grid size-9 place-items-center rounded-xl" [class]="iconClass()">
          <app-icon [name]="icon()" class="size-4.5" />
        </span>
      </div>

      <div class="mt-3 flex items-end justify-between gap-4">
        <div class="min-w-0">
          <p class="text-3xl font-bold tracking-tight text-ink tabular-nums" [class.!text-xl]="muted()" [class.!text-ink-subtle]="muted()">{{ value() }}</p>
          <p class="mt-1 text-xs text-ink-subtle">
            @if (delta(); as d) {
              <span class="mr-1 font-semibold" [class]="d.startsWith('-') ? 'text-bad-ink' : 'text-good-ink'">{{ d }}</span>
            }
            {{ caption() }}
          </p>
        </div>

        @if (sparkline(); as s) {
          <app-sparkline [data]="s.data" [color]="s.color" class="h-11 w-28 shrink-0" />
        }
      </div>

      @if (progress(); as p) {
        <div class="mt-4">
          <div
            class="h-2 overflow-hidden rounded-full bg-surface-subtle"
            role="progressbar"
            [attr.aria-label]="p.label"
            [attr.aria-valuenow]="p.value"
            aria-valuemin="0"
            [attr.aria-valuemax]="p.max"
          >
            <div class="h-full rounded-full bg-series-1 transition-[width] duration-500" [style.width.%]="p.percent"></div>
          </div>
          <p class="mt-1.5 text-xs text-ink-subtle">{{ p.percent }}% of daily fulfilment capacity ({{ p.max }})</p>
        </div>
      }
    </article>
  `,
  host: { class: 'block' },
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly caption = input('');
  readonly delta = input<string | null>(null);
  readonly icon = input.required<IconName>();
  readonly iconClass = input('bg-accent-soft text-accent-ink');
  readonly visual = input.required<KpiVisual>();
  /** Renders the value de-emphasised (e.g. when access is restricted). */
  readonly muted = input(false);

  protected readonly sparkline = computed(() => {
    const v = this.visual();
    return v.kind === 'sparkline' ? v : null;
  });

  protected readonly progress = computed(() => {
    const v = this.visual();
    if (v.kind !== 'progress') return null;
    return { ...v, percent: v.max > 0 ? Math.round(Math.min(1, v.value / v.max) * 100) : 0 };
  });
}
