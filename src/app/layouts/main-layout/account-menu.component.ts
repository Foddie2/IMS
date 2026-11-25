import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ROLE_LABELS } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/components/icon.component';

const MENU_WIDTH = 288;

/** Account popover: who am I, my role and warehouse access, sign out. */
@Component({
  selector: 'app-account-menu',
  imports: [IconComponent],
  template: `
    <button
      #trigger
      type="button"
      class="flex shrink-0 items-center gap-2 rounded-sm p-1 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-blue-600"
      popovertarget="account-menu"
      aria-controls="account-menu"
      [attr.aria-expanded]="open()"
    >
      <span class="grid size-8 place-items-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white" aria-hidden="true">
        {{ auth.initials() }}
      </span>
      <app-icon name="chevron-down" class="hidden size-4 text-ink-subtle sm:block" />
      <span class="sr-only">Account menu for {{ auth.user().name }}</span>
    </button>

    <div
      #menu
      id="account-menu"
      popover
      class="inset-auto m-0 w-72 rounded-sm border border-line bg-surface p-0 text-sm text-ink shadow-xl"
      [style.position]="'fixed'"
      [style.top.px]="position().top"
      [style.left.px]="position().left"
      (toggle)="onToggle($event)"
    >
      <div class="border-b border-line p-4">
        <p class="font-semibold">{{ auth.user().name }}</p>
        <p class="truncate text-xs text-ink-subtle">{{ auth.email() }}</p>
        <p class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink">
          <app-icon name="shield" class="size-3.5" />
          {{ roleLabels[auth.user().role] }}
        </p>
        <p class="mt-2 text-xs text-ink-subtle">
          @if (auth.user().siteIds.includes('*')) {
            Access to all warehouses
          } @else {
            Access to {{ auth.user().siteIds.length }} assigned warehouse{{ auth.user().siteIds.length === 1 ? '' : 's' }}
          }
        </p>
      </div>

      <div class="p-2">
        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left text-ink-secondary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-blue-600"
          (click)="signOut()"
        >
          <app-icon name="logout" class="size-4 text-ink-subtle" /> Sign out
        </button>
      </div>
    </div>
  `,
})
export class AccountMenuComponent {
  protected readonly auth = inject(AuthService);
  protected readonly roleLabels = ROLE_LABELS;

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild.required<ElementRef<HTMLElement>>('menu');
  protected readonly open = signal(false);
  protected readonly position = signal({ top: 0, left: 0 });

  protected onToggle(event: Event): void {
    const isOpen = (event as ToggleEvent).newState === 'open';
    this.open.set(isOpen);
    if (!isOpen) return;
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    this.position.set({ top: rect.bottom + 8, left: Math.max(8, rect.right - MENU_WIDTH) });
  }

  protected signOut(): void {
    this.menu().nativeElement.hidePopover();
    this.auth.logout({ redirect: true, returnUrl: '' });
  }
}
