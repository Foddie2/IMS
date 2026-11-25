import { DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { FlowPoint } from '../../../core/models/inventory.models';
import { PanelComponent } from '../../../shared/components/panel.component';
import { injectElementWidth } from '../../../shared/utils/element-width';

const HEIGHT = 264;
const PAD = { top: 16, right: 16, bottom: 32, left: 48 } as const;
const SERIES = {
  inbound: { label: 'Inventory inflow', color: 'var(--color-series-1)' },
  outbound: { label: 'Outbound', color: 'var(--color-series-2)' },
} as const;

function niceCeil(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

function smoothPath(points: readonly (readonly [number, number])[]): string {
  return points
    .map(([x, y], i) => {
      if (i === 0) return `M${x},${y}`;
      const [px, py] = points[i - 1];
      const cx = (px + x) / 2;
      return `C${cx},${py} ${cx},${y} ${x},${y}`;
    })
    .join(' ');
}

@Component({
  selector: 'app-inventory-flow-chart',
  imports: [DecimalPipe, PanelComponent],
  template: `
    <app-panel heading="Inventory Flow & Sales Performance" subheading="Units received vs. units shipped per month">
      <span panelActions class="rounded-sm border border-line px-2.5 py-1 text-xs font-medium text-ink-muted">Last 12 months</span>

      <ul class="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted" aria-label="Legend">
        @for (s of legend; track s.key) {
          <li class="flex items-center gap-2">
            <span class="h-0.5 w-4 rounded-full" [style.background-color]="s.color" aria-hidden="true"></span>
            {{ s.label }}
            <span class="font-semibold text-ink tabular-nums">{{ totals()[s.key] | number }}</span>
          </li>
        }
      </ul>

      <div
        class="relative rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        tabindex="0"
        role="group"
        aria-roledescription="chart"
        aria-label="Inventory flow and outbound, last 12 months. Use left and right arrow keys to inspect months."
        (keydown)="onKeydown($event)"
        (focus)="hovered.set(hovered() ?? data().length - 1)"
        (blur)="hovered.set(null)"
        (pointerleave)="hovered.set(null)"
      >
        <svg
          [attr.viewBox]="'0 0 ' + geometry().width + ' ' + height"
          [attr.height]="height"
          class="block w-full touch-pan-y select-none"
          aria-hidden="true"
          (pointermove)="onPointerMove($event)"
        >
          <defs>
            <linearGradient id="flow-inbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [style.stop-color]="legend[0].color" stop-opacity="0.28" />
              <stop offset="100%" [style.stop-color]="legend[0].color" stop-opacity="0.02" />
            </linearGradient>
            <linearGradient id="flow-outbound" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [style.stop-color]="legend[1].color" stop-opacity="0.12" />
              <stop offset="100%" [style.stop-color]="legend[1].color" stop-opacity="0.02" />
            </linearGradient>
          </defs>

          @for (tick of geometry().ticks; track tick.value) {
            <line [attr.x1]="pad.left" [attr.x2]="geometry().width - pad.right" [attr.y1]="tick.y" [attr.y2]="tick.y" [class]="tick.value === 0 ? 'stroke-line-strong' : 'stroke-line'" stroke-width="1" />
            <text [attr.x]="pad.left - 10" [attr.y]="tick.y" text-anchor="end" dominant-baseline="middle" class="fill-ink-subtle text-[11px] tabular-nums">
              {{ tick.label }}
            </text>
          }

          @for (label of geometry().xLabels; track label.text) {
            <text [attr.x]="label.x" [attr.y]="height - 10" text-anchor="middle" class="fill-ink-subtle text-[11px]">{{ label.text }}</text>
          }

          <path [attr.d]="geometry().inbound.area" fill="url(#flow-inbound)" />
          <path [attr.d]="geometry().outbound.area" fill="url(#flow-outbound)" />
          <path [attr.d]="geometry().inbound.line" fill="none" [style.stroke]="legend[0].color" stroke-width="2" stroke-linejoin="round" />
          <path [attr.d]="geometry().outbound.line" fill="none" [style.stroke]="legend[1].color" stroke-width="2" stroke-linejoin="round" />

          @if (active(); as a) {
            <line [attr.x1]="a.x" [attr.x2]="a.x" [attr.y1]="pad.top" [attr.y2]="height - pad.bottom" class="stroke-ink-faint" stroke-width="1" stroke-dasharray="3 3" />
            <circle [attr.cx]="a.x" [attr.cy]="a.inboundY" r="5" [style.fill]="legend[0].color" class="stroke-surface" stroke-width="2" />
            <circle [attr.cx]="a.x" [attr.cy]="a.salesY" r="5" [style.fill]="legend[1].color" class="stroke-surface" stroke-width="2" />
          }
        </svg>

        @if (active(); as a) {
          <div
            class="pointer-events-none absolute top-2 z-10 min-w-40 -translate-x-1/2 rounded-sm border border-line bg-surface px-3 py-2 text-xs shadow-lg"
            [style.left.px]="a.tooltipX"
            aria-hidden="true"
          >
            <p class="mb-1 font-semibold text-ink">{{ a.point.label }}</p>
            <p class="flex items-center justify-between gap-4 text-ink-muted">
              <span class="flex items-center gap-1.5"><span class="size-2 rounded-full" [style.background-color]="legend[0].color"></span>Inflow</span>
              <span class="font-semibold text-ink tabular-nums">{{ a.point.inbound | number }}</span>
            </p>
            <p class="flex items-center justify-between gap-4 text-ink-muted">
              <span class="flex items-center gap-1.5"><span class="size-2 rounded-full" [style.background-color]="legend[1].color"></span>Outbound</span>
              <span class="font-semibold text-ink tabular-nums">{{ a.point.outbound | number }}</span>
            </p>
          </div>
        }
      </div>

      <p class="sr-only" aria-live="polite">
        @if (active(); as a) {
          {{ a.point.label }}: inflow {{ a.point.inbound | number }} units, outbound {{ a.point.outbound | number }} units.
        }
      </p>
    </app-panel>
  `,
  host: { class: 'block' },
})
export class InventoryFlowChartComponent {
  readonly data = input.required<readonly FlowPoint[]>();

  private readonly hostWidth = injectElementWidth(640);
  protected readonly height = HEIGHT;
  protected readonly pad = PAD;
  protected readonly legend = [
    { key: 'inbound' as const, ...SERIES.inbound },
    { key: 'outbound' as const, ...SERIES.outbound },
  ];
  protected readonly hovered = signal<number | null>(null);

  protected readonly totals = computed(() =>
    this.data().reduce(
      (acc, p) => ({ inbound: acc.inbound + p.inbound, outbound: acc.outbound + p.outbound }),
      { inbound: 0, outbound: 0 },
    ),
  );

  protected readonly geometry = computed(() => {
    const data = this.data();
    // Panel padding (2 × 20px) is outside the drawing area.
    const width = Math.max(this.hostWidth() - 40, 280);
    const plotW = width - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const max = niceCeil(Math.max(1, ...data.flatMap((d) => [d.inbound, d.outbound])));
    const step = data.length > 1 ? plotW / (data.length - 1) : 0;

    const x = (i: number) => PAD.left + i * step;
    const y = (v: number) => PAD.top + plotH * (1 - v / max);
    const baseline = PAD.top + plotH;

    const series = (key: 'inbound' | 'outbound') => {
      const points = data.map((d, i) => [x(i), y(d[key])] as const);
      const line = smoothPath(points);
      const area = points.length
        ? `${line} L${x(points.length - 1)},${baseline} L${x(0)},${baseline} Z`
        : '';
      return { line, area };
    };

    const labelEvery = width < 420 ? 3 : width < 620 ? 2 : 1;
    const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

    return {
      width,
      step,
      x,
      y,
      inbound: series('inbound'),
      outbound: series('outbound'),
      ticks: [0, 0.25, 0.5, 0.75, 1].map((t) => ({
        value: max * t,
        y: PAD.top + plotH * (1 - t),
        label: compact.format(max * t),
      })),
      xLabels: data
        .map((d, i) => ({ text: d.label, x: x(i), show: i % labelEvery === (data.length - 1) % labelEvery }))
        .filter((l) => l.show),
    };
  });

  protected readonly active = computed(() => {
    const index = this.hovered();
    const point = index === null ? undefined : this.data()[index];
    if (index === null || !point) return null;
    const g = this.geometry();
    const x = g.x(index);
    return {
      point,
      x,
      inboundY: g.y(point.inbound),
      salesY: g.y(point.outbound),
      tooltipX: Math.min(Math.max(x, 90), g.width - 90),
    };
  });

  protected onPointerMove(event: PointerEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const g = this.geometry();
    if (!g.step || rect.width === 0) return;
    const localX = ((event.clientX - rect.left) / rect.width) * g.width;
    const index = Math.round((localX - PAD.left) / g.step);
    this.hovered.set(Math.min(Math.max(index, 0), this.data().length - 1));
  }

  protected onKeydown(event: KeyboardEvent): void {
    const last = this.data().length - 1;
    const current = this.hovered() ?? last;
    const next =
      event.key === 'ArrowLeft' ? current - 1
      : event.key === 'ArrowRight' ? current + 1
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    this.hovered.set(Math.min(Math.max(next, 0), last));
  }
}
