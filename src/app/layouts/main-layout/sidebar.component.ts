import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Permission } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent, IconName } from '../../shared/components/icon.component';

interface NavLink {
  label: string;
  path: string;
  icon: IconName;
  /** Links the user lacks permission for are hidden. */
  permission?: Permission;
}

const PRIMARY_LINKS: readonly NavLink[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
  { label: 'Inventory', path: '/inventory', icon: 'cube', permission: 'inventory:view' },
  { label: 'Orders', path: '/orders', icon: 'orders', permission: 'orders:view' },
  { label: 'Shipments', path: '/shipments', icon: 'truck', permission: 'shipments:view' },
  { label: 'Reports', path: '/reports', icon: 'reports', permission: 'reports:view' },
];

const SECONDARY_LINKS: readonly NavLink[] = [
  { label: 'Settings', path: '/settings', icon: 'settings', permission: 'settings:manage' },
  { label: 'Support', path: '/support', icon: 'support' },
];

const LINK_CLASS =
  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-600';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="flex h-full flex-col bg-surface">
      <div class="flex h-16 items-center justify-between gap-2 px-5">
        <a routerLink="/dashboard" class="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          <span class="grid size-9 place-items-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/30">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
              <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" />
              <path d="m3 7 9 5 9-5M12 12v10" />
            </svg>
          </span>
          <span class="flex flex-col leading-tight">
            <span class="text-lg font-bold tracking-tight text-ink">IMS</span>
            <span class="text-[11px] font-medium text-ink-subtle">Inventory Management System</span>
          </span>
        </a>
        @if (dismissible()) {
          <button
            type="button"
            class="grid size-9 place-items-center rounded-lg text-ink-subtle hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden"
            (click)="closed.emit()"
          >
            <app-icon name="close" class="size-5" />
            <span class="sr-only">Close navigation</span>
          </button>
        }
      </div>

      <nav aria-label="Main" class="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        <ul class="flex flex-col gap-1">
          @for (link of primaryLinks(); track link.path) {
            <li>
              <a
                [routerLink]="link.path"
                routerLinkActive="!bg-accent-soft !text-accent-ink [&_app-icon]:!text-accent-ink"
                ariaCurrentWhenActive="page"
                [class]="linkClass"
                (click)="navigated.emit()"
              >
                <app-icon [name]="link.icon" class="size-5 text-ink-faint group-hover:text-ink-muted" />
                {{ link.label }}
              </a>
            </li>
          }
        </ul>

        <div>
          <p class="px-3 pb-2 text-xs font-semibold tracking-wider text-ink-subtle uppercase">Account</p>
          <ul class="flex flex-col gap-1">
            @for (link of secondaryLinks(); track link.path) {
              <li>
                <a
                  [routerLink]="link.path"
                  routerLinkActive="!bg-accent-soft !text-accent-ink [&_app-icon]:!text-accent-ink"
                  ariaCurrentWhenActive="page"
                  [class]="linkClass"
                  (click)="navigated.emit()"
                >
                  <app-icon [name]="link.icon" class="size-5 text-ink-faint group-hover:text-ink-muted" />
                  {{ link.label }}
                </a>
              </li>
            }
          </ul>
        </div>
      </nav>

      <div class="border-t border-line p-4">
        <div class="flex items-center gap-3 rounded-xl p-2">
          <span class="grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white" aria-hidden="true">
            {{ auth.initials() }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-ink">{{ auth.user().name }}</p>
            <p class="truncate text-xs text-ink-subtle">{{ auth.user().title }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  host: { class: 'block h-full' },
})
export class SidebarComponent {
  protected readonly auth = inject(AuthService);

  /** Shows the close button (mobile off-canvas mode). */
  readonly dismissible = input(false);
  readonly closed = output();
  readonly navigated = output();

  protected readonly linkClass = LINK_CLASS;
  private readonly visible = (links: readonly NavLink[]) =>
    links.filter((link) => !link.permission || this.auth.can(link.permission));

  protected readonly primaryLinks = computed(() => this.visible(PRIMARY_LINKS));
  protected readonly secondaryLinks = computed(() => this.visible(SECONDARY_LINKS));
}
