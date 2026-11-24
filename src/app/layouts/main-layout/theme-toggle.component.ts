import { Component, computed, inject } from '@angular/core';
import { ThemePreference, ThemeService } from '../../core/services/theme.service';
import { IconComponent, IconName } from '../../shared/components/icon.component';

const META: Record<ThemePreference, { icon: IconName; label: string; next: string }> = {
  light: { icon: 'sun', label: 'Light', next: 'dark' },
  dark: { icon: 'moon', label: 'Dark', next: 'system' },
  system: { icon: 'monitor', label: 'System', next: 'light' },
};

@Component({
  selector: 'app-theme-toggle',
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="grid size-10 place-items-center rounded-xl text-ink-muted hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-600"
      [title]="'Theme: ' + meta().label"
      (click)="theme.cycle()"
    >
      <app-icon [name]="meta().icon" class="size-5" />
      <span class="sr-only">Theme: {{ meta().label }}. Switch to {{ meta().next }} theme</span>
    </button>
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly meta = computed(() => META[this.theme.preference()]);
}
