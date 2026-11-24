import { Component, computed, input } from '@angular/core';

interface Bar {
  x: number;
  width: number;
}

/**
 * Deterministic, visually convincing 1-D barcode rendered as SVG.
 * It is a mock (not a scannable symbology) – swap in a real encoder such as
 * JsBarcode if the labels need to be printed and scanned.
 */
@Component({
  selector: 'app-barcode',
  template: `
    <figure class="flex flex-col items-start gap-0.5">
      <svg
        [attr.viewBox]="'0 0 ' + bars().width + ' 30'"
        preserveAspectRatio="none"
        class="h-7 w-28"
        role="img"
        [attr.aria-label]="'Barcode ' + value()"
      >
        @for (bar of bars().items; track $index) {
          <rect [attr.x]="bar.x" y="0" [attr.width]="bar.width" height="30" class="fill-ink" />
        }
      </svg>
      <figcaption class="font-mono text-[11px] leading-none tracking-wider text-ink-muted" aria-hidden="true">
        {{ caption() }}
      </figcaption>
    </figure>
  `,
})
export class BarcodeComponent {
  readonly value = input.required<string>();

  protected readonly caption = computed(() => {
    const v = this.value();
    return v.length > 16 ? `${v.slice(0, 15)}…` : v;
  });

  protected readonly bars = computed(() => {
    const items: Bar[] = [];
    let x = 0;
    const push = (width: number, gap: number) => {
      items.push({ x, width });
      x += width + gap;
    };

    push(1, 1);
    push(1, 1); // start guard
    for (const char of this.value().slice(0, 18)) {
      const code = char.charCodeAt(0);
      push((code & 3) + 1, ((code >> 2) & 1) + 1);
      push(((code >> 3) & 1) + 1, ((code >> 4) & 3) + 1);
      push(((code >> 5) & 1) + 1, 1);
    }
    push(1, 1);
    push(1, 0); // end guard
    return { items, width: x };
  });
}
