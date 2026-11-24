import { Component, computed, input } from '@angular/core';

const WIDTH = 120;
const HEIGHT = 40;
const PAD = 3;

let nextSparklineId = 0;

/** Tiny trend line with a soft gradient fill. Purely decorative: the KPI value carries the meaning. */
@Component({
  selector: 'app-sparkline',
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + width + ' ' + height"
      preserveAspectRatio="none"
      class="h-full w-full overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient [id]="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" [style.stop-color]="color()" stop-opacity="0.22" />
          <stop offset="100%" [style.stop-color]="color()" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path [attr.d]="paths().area" [attr.fill]="'url(#' + gradientId + ')'" />
      <path
        [attr.d]="paths().line"
        fill="none"
        [style.stroke]="color()"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  `,
  host: { class: 'block' },
})
export class SparklineComponent {
  readonly data = input.required<readonly number[]>();
  readonly color = input('var(--color-series-1)');

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly gradientId = `spark-gradient-${nextSparklineId++}`;

  protected readonly paths = computed(() => {
    const data = this.data();
    if (data.length < 2) {
      return { line: '', area: '' };
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = WIDTH / (data.length - 1);
    const points = data.map(
      (value, i) => [i * step, PAD + (1 - (value - min) / range) * (HEIGHT - PAD * 2)] as const,
    );

    const line = points
      .map(([x, y], i) => {
        if (i === 0) return `M${x},${y}`;
        const [px, py] = points[i - 1];
        const cx = (px + x) / 2;
        return `C${cx},${py} ${cx},${y} ${x},${y}`;
      })
      .join(' ');
    return { line, area: `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z` };
  });
}
