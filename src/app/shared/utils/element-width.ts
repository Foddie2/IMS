import { DestroyRef, ElementRef, afterNextRender, inject, signal } from '@angular/core';

/**
 * Tracks the rendered width of the host element as a signal (browser only).
 * Lets SVG charts draw in real pixels so text never scales or distorts.
 * Must be called in an injection context.
 */
export function injectElementWidth(fallback: number) {
  const host = inject<ElementRef<HTMLElement>>(ElementRef);
  const destroyRef = inject(DestroyRef);
  const width = signal(fallback);

  afterNextRender(() => {
    const element = host.nativeElement;
    width.set(element.clientWidth || fallback);

    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) {
        width.set(next);
      }
    });
    observer.observe(element);
    destroyRef.onDestroy(() => observer.disconnect());
  });

  return width.asReadonly();
}
