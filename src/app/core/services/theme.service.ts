import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, Service, computed, effect, inject, signal } from '@angular/core';
import { STORAGE_KEYS, readStorage, writeStorage } from '../utils/browser-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

const ORDER: readonly ThemePreference[] = ['light', 'dark', 'system'];

function isPreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Light / dark / system theme. Applies the `.dark` class on <html>; the inline
 * boot script in index.html does the same before Angular loads to avoid a flash.
 */
@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly systemPrefersDark = signal(false);
  readonly preference = signal<ThemePreference>('system');
  readonly resolved = computed<'light' | 'dark'>(() => {
    const preference = this.preference();
    if (preference !== 'system') return preference;
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  constructor() {
    if (!this.isBrowser) return;

    const stored = readStorage(STORAGE_KEYS.theme);
    if (isPreference(stored)) this.preference.set(stored);

    const view = this.document.defaultView;
    const media =
      typeof view?.matchMedia === 'function' ? view.matchMedia('(prefers-color-scheme: dark)') : null;
    if (media) {
      this.systemPrefersDark.set(media.matches);
      const listener = (event: MediaQueryListEvent) => this.systemPrefersDark.set(event.matches);
      media.addEventListener('change', listener);
      inject(DestroyRef).onDestroy(() => media.removeEventListener('change', listener));
    }

    effect(() => {
      const dark = this.resolved() === 'dark';
      const root = this.document.documentElement;
      root.classList.toggle('dark', dark);
      root.style.colorScheme = dark ? 'dark' : 'light';
    });
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
    writeStorage(STORAGE_KEYS.theme, preference);
  }

  /** light → dark → system → light … */
  cycle(): void {
    const next = ORDER[(ORDER.indexOf(this.preference()) + 1) % ORDER.length];
    this.setPreference(next);
  }
}
